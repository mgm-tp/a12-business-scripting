/*
 * SPDX-License-Identifier: EUPL-1.2 OR LicenseRef-commercial
 *
 * Copyright (c) 2012-2026 mgm technology partners GmbH
 *
 * Dual License
 * ------------
 * This source file is part of the mgm A12 Platform and available under
 * a choice of two different licenses:
 *
 * 1. Open-Source License – EUPL v1.2
 *    You may redistribute and/or modify this file under the terms of the
 *    European Union Public License, version 1.2 - see https://eupl.eu/.
 *
 * 2. Commercial License
 *    Alternatively, you may obtain a commercial license from
 *    mgm technology partners GmbH, that permits use of this software
 *    under different terms (including support and maintenance services).
 *
 *    Please contact a12-license@mgm-tp.com for more information.
 *
 * You must select and comply with exactly one of the above license options.
 *
 * Warranty Disclaimer (applies to either option)
 * ----------------------------------------------
 * THIS SOFTWARE IS PROVIDED "AS IS" AND WITHOUT WARRANTY OF ANY KIND,
 * WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NON-INFRINGEMENT, EXCEPT WHERE SUCH DISCLAIMERS ARE HELD TO BE
 * LEGALLY INVALID. SEE THE RESPECTIVE LICENSE TEXT FOR DETAILS.
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {ExecutionContext} from '../../api/execution-contexts.js';
import {BusinessScriptingVetoError, ScriptExecutionError} from '../../api/errors.js';
import {A12} from '../../api/facades/index.js';
import type {ScriptOptions} from '../../api/facades/scripts.js';
import {DocumentReference} from '../../api/document-reference.js';
import {mockJavaThrowable} from '../../internal/mock-helpers.js';

import {VETO_EXCEPTION_CLASS_NAME, VETO_REASON} from '../test-helpers.js';

const DOCUMENT_ID = '1';
const CALLED_SCRIPT_FAILURE_MESSAGE = "Script 'inner.js' failed at inner.ts:3 caused by: ModelNotFoundError: Model 'Nonexistent_DM' not found.";

function mockJavaDocumentReference(documentModelName: string, documentId: string) {
    return {
        getDocumentModelName: () => documentModelName,
        getDocumentId: () => documentId,
        toString: () => `${documentModelName}/${documentId}`,
    };
}

function mockJavaList<T>(items: T[]) {
    return {size: () => items.length, get: (index: number) => items[index]};
}
const contextHolder = vi.hoisted(() => ({current: undefined as ExecutionContext | undefined}));

vi.mock('../../api/execution-contexts.js', async (importOriginal) => {
    const orig = await importOriginal<typeof import('../../api/execution-contexts.js')>();
    return {
        ...orig,
        get executionContext() {
            return contextHolder.current ?? orig.executionContext;
        },
    };
});

const mockCallScript = vi.fn();
const mockTryCallScript = vi.fn();

const fakeDataServicesContext = {
    documentService: {},
    queryService: {},
    scriptCaller: {callScript: mockCallScript},
} as unknown as ExecutionContext;

const fakeWorkflowContext = {
    dataServicesRpcFacade: {tryCallScript: mockTryCallScript},
} as unknown as ExecutionContext;

describe('A12.Scripts.call in TestContext', () => {
    it('should throw when options.targetContext is not set', async () => {
        await expect(
            A12.Scripts.call('createInvoice', { orderRef: 'abc/123' })
        ).rejects.toThrow('[A12.Scripts.call] TestContext requires options.targetContext to be set!');
    });

    it('should throw when options.targetContext is neither "dataServices" nor "workflows"', async () => {
        // Cast bypasses the compile-time union check to simulate an invalid runtime value,
        // e.g. from an untyped script caller.
        await expect(
            A12.Scripts.call('createInvoice', {}, {targetContext: 'invalidContext'} as unknown as ScriptOptions)
        ).rejects.toThrow('A12.Scripts.call: unsupported target context');
    });
});

describe('A12.Scripts.call in DataServicesContext', () => {
    beforeEach(() => {
        contextHolder.current = fakeDataServicesContext;
        mockCallScript.mockClear();
    });

    afterEach(() => {
        contextHolder.current = undefined;
    });

    it('should throw when options.targetContext is set', async () => {
        await expect(
            A12.Scripts.call('myScript', {}, {targetContext: 'dataServices'})
        ).rejects.toThrow('[A12.Scripts.call] The option targetContext is not allowed');
    });

    it('should call scriptCaller.callScript with scriptName and args', async () => {
        // given
        mockCallScript.mockReturnValue(new Map([['result', '42']]));

        // when
        const result = await A12.Scripts.call('myScript', {input: 'value'});

        // then
        expect(mockCallScript).toHaveBeenCalledWith('myScript', new Map([['input', 'value']]));
        expect(result).toEqual({result: '42'});
    });

    it('should convert a JavaDocumentReference into a DocumentReference', async () => {
        // given
        // Results are not serialized in this context: the Java DocumentReference reaches the script
        // as a GraalJS host object exposing the getters of the Java class.
        mockCallScript.mockReturnValue(new Map([['createdDocRef', mockJavaDocumentReference('Project_DM', '1')]]));

        // when
        const result = await A12.Scripts.call<{createdDocRef: DocumentReference}>('myScript', {});

        // then
        expect(result.createdDocRef).toEqual(new DocumentReference('Project_DM', '1'));
    });

    it('should convert JavaDocumentReference inside a JavaList', async () => {
        // given
        // A script output declared as SimpleList<DocumentReference> or DocumentReference[] arrives
        // as a Java list host object, which is neither a JS array nor SimpleList-shaped.
        const javaList = mockJavaList([
            mockJavaDocumentReference('Project_DM', '1'),
            mockJavaDocumentReference('Project_DM', '2'),
        ]);
        mockCallScript.mockReturnValue(new Map([['createdDocRefs', javaList]]));

        // when
        const result = await A12.Scripts.call<{createdDocRefs: DocumentReference[]}>('myScript', {});

        // then
        expect(result.createdDocRefs).toEqual([
            new DocumentReference('Project_DM', '1'),
            new DocumentReference('Project_DM', '2'),
        ]);
    });

    it('should not name the script again when the called script already named itself', async () => {
        // given — the called script's own surfaced failure, behind the operation prefix that
        // mapDsError's final fallback prepends
        mockCallScript.mockImplementation(() => {
            throw new Error(CALLED_SCRIPT_FAILURE_MESSAGE);
        });

        // when
        const call = A12.Scripts.call('myScript', {});

        // then — still a typed script execution error, carrying the identity exactly once
        await expect(call).rejects.toBeInstanceOf(ScriptExecutionError);
        await expect(call).rejects.toThrow(CALLED_SCRIPT_FAILURE_MESSAGE);
        await expect(call).rejects.not.toThrow("Script 'myScript' failed");
    });

    it('should rethrow the veto of the called script as BusinessScriptingVetoError', async () => {
        // given
        mockCallScript.mockImplementation(() => {
            throw mockJavaThrowable(VETO_EXCEPTION_CLASS_NAME, VETO_REASON);
        });

        // when
        const call = A12.Scripts.call('myScript', {});

        // then
        await expect(call).rejects.toBeInstanceOf(BusinessScriptingVetoError);
        await expect(call).rejects.toHaveProperty('message', VETO_REASON);
    });

    it('should return a JavaList as a plain JS array so array functions work without conversion', async () => {
        // given
        // A SimpleList<DocumentReference> script output is a Java list by the time it reaches the
        // caller, and scripters must receive a JS array rather than a Java or SimpleList value.
        const javaList = mockJavaList([mockJavaDocumentReference('Project_DM', '1')]);
        mockCallScript.mockReturnValue(new Map([['createdDocRefs', javaList]]));

        // when
        const result = await A12.Scripts.call<{createdDocRefs: DocumentReference[]}>('myScript', {});

        // then
        expect(Array.isArray(result.createdDocRefs)).toBe(true);
        expect(result.createdDocRefs.map((docRef) => docRef.documentModelName)).toEqual(['Project_DM']);
    });
});

describe('A12.Scripts.call in WorkflowContext', () => {
    beforeEach(() => {
        contextHolder.current = fakeWorkflowContext;
        mockTryCallScript.mockClear();
    });

    afterEach(() => {
        contextHolder.current = undefined;
    });

    it('should throw when options.targetContext is set', async () => {
        await expect(
            A12.Scripts.call('myScript', {}, {targetContext: 'workflows'})
        ).rejects.toThrow('[A12.Scripts.call] The option targetContext is not allowed');
    });

    it('should call dataServicesRpcFacade.tryCallScript with scriptName and args', async () => {
        // given
        mockTryCallScript.mockReturnValue('{"result":"42"}');

        // when
        const result = await A12.Scripts.call('myScript', {input: 'value'});

        // then
        expect(mockTryCallScript).toHaveBeenCalledWith('myScript', new Map([['input', 'value']]));
        expect(result).toEqual({result: '42'});
    });

    it('should parse a JSON string result and convert the docRefs it contains', async () => {
        // given
        // The workflow engine receives the script result as a JSON string from the CALL_SCRIPT RPC
        mockTryCallScript.mockReturnValue(`{"createdDocRef":"Project_DM/${DOCUMENT_ID}"}`);

        // when
        const result = await A12.Scripts.call<{createdDocRef: DocumentReference}>('myScript', {});

        // then
        expect(result.createdDocRef).toEqual(new DocumentReference('Project_DM', DOCUMENT_ID));
    });
});
