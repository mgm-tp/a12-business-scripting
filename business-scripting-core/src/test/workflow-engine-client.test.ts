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

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentReference } from '../api/document-reference.js';
import { AuthenticationError } from '../api/errors.js';
import { toProcessEngineVariable, WorkflowEngineClient } from '../internal/workflow-engine-client.js';

import { TEST_AUTHORIZATION_HEADER } from './test-helpers.js';

describe('toProcessEngineVariable', () => {
    it('should map string to String type', () => {
        expect(toProcessEngineVariable('hello')).toEqual({ value: 'hello', type: 'String' });
    });

    it('should map boolean to Boolean type', () => {
        expect(toProcessEngineVariable(true)).toEqual({ value: true, type: 'Boolean' });
        expect(toProcessEngineVariable(false)).toEqual({ value: false, type: 'Boolean' });
    });

    it('should map integer number to Integer type', () => {
        expect(toProcessEngineVariable(42)).toEqual({ value: 42, type: 'Integer' });
        expect(toProcessEngineVariable(0)).toEqual({ value: 0, type: 'Integer' });
    });

    it('should map float number to Double type', () => {
        expect(toProcessEngineVariable(3.14)).toEqual({ value: 3.14, type: 'Double' });
    });

    it('should map DocumentReference to String type using toString()', () => {
        const docRef = new DocumentReference('Contract_DM', 'abc-123');
        expect(toProcessEngineVariable(docRef)).toEqual({ value: 'Contract_DM/abc-123', type: 'String' });
    });

    it.each([
        ['plain object', { key: 'value' }],
        ['string array', ['a', 'b', 'c']],
        ['nested number array', [[1, 2], [3, 4]]],
    ])('should map %s to String type with JSON-serialized value', (_, input) => {
        expect(toProcessEngineVariable(input)).toEqual({ value: JSON.stringify(input), type: 'String' });
    });

    it('should throw for null', () => {
        expect(() => toProcessEngineVariable(null)).toThrow('toProcessEngineVariable: unsupported value: null');
    });

    it('should throw for undefined', () => {
        expect(() => toProcessEngineVariable(undefined)).toThrow('toProcessEngineVariable: unsupported value: undefined');
    });
});

describe('WorkflowEngineClient', () => {
    const ENGINE_BASE_URL = 'http://engine:8091/engine-rest';
    const PROCESS_INSTANCE_ID = 'process-instance-456';
    const SCRIPT_NAME = 'createInvoice';
    const BUSINESS_KEY = 'business-key-1';

    function jsonResponse(json: unknown): Response {
        return { ok: true, json: () => Promise.resolve(json), text: () => Promise.resolve('') } as unknown as Response;
    }

    function stubFetch(json: unknown = {}): ReturnType<typeof vi.fn> {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(json));
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    function clientUnderTest(): WorkflowEngineClient {
        return new WorkflowEngineClient(ENGINE_BASE_URL, TEST_AUTHORIZATION_HEADER);
    }

    function requestInitOf(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
        return fetchMock.mock.calls[0]![1] as RequestInit;
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('getHistoricVariables', () => {
        it('should query variables filtered by the given process instance id', async () => {
            // given — filtering by processInstanceId is essential: an unsupported filter param would be
            // silently ignored by the engine and return the variables of ALL historic process instances.
            const fetchMock = stubFetch([{ name: 'result', value: '42' }]);

            // when
            const variables = await clientUnderTest().getHistoricVariables(PROCESS_INSTANCE_ID);

            // then
            expect(variables).toEqual({ result: '42' });
            expect(fetchMock).toHaveBeenCalledWith(
                `${ENGINE_BASE_URL}/history/variable-instance?processInstanceId=${PROCESS_INSTANCE_ID}`,
                expect.anything(),
            );
        });

        it('should send the credential', async () => {
            const fetchMock = stubFetch([]);

            await clientUnderTest().getHistoricVariables(PROCESS_INSTANCE_ID);

            expect(requestInitOf(fetchMock).headers).toEqual({ Authorization: TEST_AUTHORIZATION_HEADER });
        });
    });

    describe('startProcessInstance', () => {
        it('should send the credential alongside the JSON content type', async () => {
            const fetchMock = stubFetch({ id: PROCESS_INSTANCE_ID });

            await clientUnderTest().startProcessInstance(SCRIPT_NAME, BUSINESS_KEY, { amount: 1 });

            expect(requestInitOf(fetchMock).headers).toEqual({
                'Content-Type': 'application/json',
                Authorization: TEST_AUTHORIZATION_HEADER,
            });
        });
    });

    describe('deployScriptDelegateProcess', () => {
        it('should send the credential without a content type, so fetch generates the multipart boundary', async () => {
            const fetchMock = stubFetch();

            await clientUnderTest().deployScriptDelegateProcess(SCRIPT_NAME);

            expect(requestInitOf(fetchMock).headers).toEqual({ Authorization: TEST_AUTHORIZATION_HEADER });
        });
    });

    describe('a credential the engine rejects', () => {
        const HTTP_UNAUTHORIZED_STATUS = 401;
        const HTTP_FORBIDDEN_STATUS = 403;

        function stubRejectingFetch(status: number): void {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status,
                text: () => Promise.resolve('{"status": 401, "error":"Unauthorized"}'),
            } as unknown as Response));
        }

        // given: every call of the engine carries the credential, so every one of them can be rejected for
        // it. Reported as an operation failure, the cause would look like a broken deployment or process.
        const engineCalls: Array<[string, (client: WorkflowEngineClient) => Promise<unknown>]> = [
            ['deployScriptDelegateProcess', client => client.deployScriptDelegateProcess(SCRIPT_NAME)],
            ['startProcessInstance', client => client.startProcessInstance(SCRIPT_NAME, BUSINESS_KEY, {})],
            ['getHistoricVariables', client => client.getHistoricVariables(PROCESS_INSTANCE_ID)],
        ];

        it.each(engineCalls)('should report %s rejected with HTTP 401 as an authentication failure', async (_, call) => {
            stubRejectingFetch(HTTP_UNAUTHORIZED_STATUS);

            await expect(call(clientUnderTest())).rejects.toThrow(AuthenticationError);
        });

        it('should report a forbidden response with the engine message, not as an authentication failure', async () => {
            stubRejectingFetch(HTTP_FORBIDDEN_STATUS);

            const error = await clientUnderTest()
                .deployScriptDelegateProcess(SCRIPT_NAME)
                .catch((thrown: unknown) => thrown as Error);

            expect(error).not.toBeInstanceOf(AuthenticationError);
            expect(error.message).toContain(`BPMN deployment failed: ${HTTP_FORBIDDEN_STATUS}`);
        });

        it('should name the environment variable that holds the certificate', async () => {
            stubRejectingFetch(HTTP_UNAUTHORIZED_STATUS);

            await expect(clientUnderTest().deployScriptDelegateProcess(SCRIPT_NAME))
                .rejects.toThrow('A12_SCRIPTING_TESTING_API_KEY_FILE');
        });
    });
});
