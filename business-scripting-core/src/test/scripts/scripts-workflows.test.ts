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

import type {ServerConnector} from '@com.mgmtp.a12.utils/utils-connector';

import {executionContext, TestContext} from '../../api/execution-contexts.js';
import {A12} from '../../api/facades';
import {clearDeployedProcessesForTesting, WORKFLOWS_URL_ENV_VAR} from '../../api/facades/scripts.js';
import {DocumentReference} from '../../api/document-reference.js';

import {TEST_AUTHORIZATION_HEADER} from '../test-helpers.js';

const DOCUMENT_MODEL_NAME = 'Employee_DM';
const FIRST_DOCUMENT_ID = '1';
const SECOND_DOCUMENT_ID = '2';
const ENGINE_BASE_URL = 'http://localhost:9000/engine-rest';

// Workflows bean serialization converts a document reference process variable
// to an object with the shape {documentModelName, documentId, valid, empty}
function mockBeanSerializedDocRef(documentModelName: string, documentId: string) {
    return {documentModelName, documentId, valid: true, empty: false};
}

const mockDeploy = vi.fn().mockResolvedValue(undefined);
const mockStart = vi.fn().mockResolvedValue('mock-process-instance-id');
const mockGetVars = vi.fn().mockResolvedValue({});
const mockClientConstruction = vi.fn();

vi.mock('../../internal/workflow-engine-client.js', () => ({
    toProcessEngineVariable: vi.fn(),
    WorkflowEngineClient: class {
        deployScriptDelegateProcess = mockDeploy;
        startProcessInstance = mockStart;
        getHistoricVariables = mockGetVars;

        constructor(baseUrl: string, authorizationHeader: string) {
            mockClientConstruction(baseUrl, authorizationHeader);
        }
    },
}));

const mockConnector: ServerConnector = { fetchData: vi.fn() };

describe('A12.Scripts.call in TestContext with targetContext: workflows', () => {
    beforeEach(() => {
        (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        vi.unstubAllEnvs();
        clearDeployedProcessesForTesting();
        mockDeploy.mockClear();
        mockStart.mockClear();
        mockGetVars.mockClear();
        mockClientConstruction.mockClear();
    });

    afterEach(() => {
        (executionContext as TestContext).reset();
    });

    it('should throw when A12_SCRIPTING_TESTING_WORKFLOWS_URL is not set', async () => {
        await expect(
            A12.Scripts.call('myScript', {}, { targetContext: 'workflows' })
        ).rejects.toThrow(`${WORKFLOWS_URL_ENV_VAR} environment variable is not set`);
    });

    it('should hand the engine URL and the test context credential to the engine client', async () => {
        // given
        vi.stubEnv(WORKFLOWS_URL_ENV_VAR, ENGINE_BASE_URL);

        // when
        await A12.Scripts.call('myScript', {}, { targetContext: 'workflows' });

        // then
        expect(mockClientConstruction).toHaveBeenCalledWith(ENGINE_BASE_URL, TEST_AUTHORIZATION_HEADER);
    });

    it('should deploy BPMN on first call and skip on second call for same script', async () => {
        // given
        vi.stubEnv(WORKFLOWS_URL_ENV_VAR, ENGINE_BASE_URL);

        // when
        await A12.Scripts.call('myScript', {}, { targetContext: 'workflows' });
        await A12.Scripts.call('myScript', {}, { targetContext: 'workflows' });

        // then
        expect(mockDeploy).toHaveBeenCalledTimes(1);
        expect(mockStart).toHaveBeenCalledTimes(2);
    });

    it('should deploy separately for different script names', async () => {
        // given
        vi.stubEnv(WORKFLOWS_URL_ENV_VAR, ENGINE_BASE_URL);

        // when
        await A12.Scripts.call('scriptOne', {}, { targetContext: 'workflows' });
        await A12.Scripts.call('scriptTwo', {}, { targetContext: 'workflows' });

        // then
        expect(mockDeploy).toHaveBeenCalledTimes(2);
    });

    it('should return only output variables, filtering out input variables', async () => {
        // given
        vi.stubEnv(WORKFLOWS_URL_ENV_VAR, ENGINE_BASE_URL);
        mockGetVars.mockResolvedValueOnce({ inputVar: 'inputValue', outputVar: 'outputValue' });

        // when
        const result = await A12.Scripts.call('myScript', { inputVar: 'inputValue' }, { targetContext: 'workflows' });

        // then
        expect(result).toEqual({ outputVar: 'outputValue' });
    });

    it('should convert a bean-serialized docRef process variable into a DocumentReference', async () => {
        // given
        vi.stubEnv(WORKFLOWS_URL_ENV_VAR, ENGINE_BASE_URL);
        mockGetVars.mockResolvedValueOnce({ outputDocRef: mockBeanSerializedDocRef(DOCUMENT_MODEL_NAME, FIRST_DOCUMENT_ID) });

        // when
        const result = await A12.Scripts.call<{ outputDocRef: DocumentReference }>('myScript', {}, { targetContext: 'workflows' });

        // then
        expect(result.outputDocRef).toEqual(new DocumentReference(DOCUMENT_MODEL_NAME, FIRST_DOCUMENT_ID));
    });

    it('should convert bean-serialized docRefs inside a process variable array', async () => {
        // given
        vi.stubEnv(WORKFLOWS_URL_ENV_VAR, ENGINE_BASE_URL);
        mockGetVars.mockResolvedValueOnce({
            outputDocRefs: [
                mockBeanSerializedDocRef(DOCUMENT_MODEL_NAME, FIRST_DOCUMENT_ID),
                mockBeanSerializedDocRef(DOCUMENT_MODEL_NAME, SECOND_DOCUMENT_ID),
            ],
        });

        // when
        const result = await A12.Scripts.call<{ outputDocRefs: DocumentReference[] }>('myScript', {}, { targetContext: 'workflows' });

        // then
        expect(result.outputDocRefs).toEqual([
            new DocumentReference(DOCUMENT_MODEL_NAME, FIRST_DOCUMENT_ID),
            new DocumentReference(DOCUMENT_MODEL_NAME, SECOND_DOCUMENT_ID),
        ]);
    });
});
