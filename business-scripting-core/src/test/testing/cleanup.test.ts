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

import type {CleanupRegistry} from '../../testing/cleanup.js';
import {PAGE_SIZE_LIMIT} from "../../internal/constants";

import {TEST_AUTHORIZATION_HEADER} from '../test-helpers.js';

const FUTURE_DATE = '2099-01-01T00:00:00';
const mockConnector = {};

const CONFIGURED_DOCUMENT_MODEL_NAMES = ['ModelA_DM', 'ModelB_DM'];
const DOCUMENT_COUNT_SPANNING_MULTIPLE_PAGES = PAGE_SIZE_LIMIT * 2 + 50;
// Two full pages plus a final short page that ends the paging.
const EXPECTED_QUERY_COUNT_FOR_MULTIPLE_PAGES = 3;
// Guards the test against a non-terminating cleanup: it fails with a message instead of hanging the suite.
const MAX_QUERIES_PER_MODEL = 10;

function makeQueryResult(docRefString: string): Record<string, unknown> {
    return makeQueryResultForDocRefs([docRefString]);
}

function makeQueryResultForDocRefs(docRefStrings: string[]): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    docRefStrings.forEach((docRefString, index) => {
        entries[`entry${index}`] = {
            document: {__meta: {createdAt: FUTURE_DATE}},
            docRef: docRefString,
        };
    });
    return {entries};
}

interface DataServicesDocumentStoreMock {
    callRpc: (connector: unknown, method: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;
    remainingDocRefsOf: (modelName: string) => string[];
    queryCountOf: (modelName: string) => number;
}

/**
 * Mocks Data Services as a document store: a QUERY returns up to PAGE_SIZE_LIMIT of the documents that are
 * still present, a DELETE_DOCUMENT removes one. Unlike a mock that returns a canned sequence of results, it
 * only stops returning documents once they have actually been deleted.
 */
function createDataServicesDocumentStoreMock(
    seededDocumentCountPerModel: number,
    {deleteRemovesDocument = true}: {deleteRemovesDocument?: boolean} = {},
): DataServicesDocumentStoreMock {
    const remainingDocRefsByModel = new Map<string, string[]>(
        CONFIGURED_DOCUMENT_MODEL_NAMES.map(modelName => [modelName, seedDocRefStrings(modelName, seededDocumentCountPerModel)]),
    );
    const queryCountByModel = new Map<string, number>(
        CONFIGURED_DOCUMENT_MODEL_NAMES.map(modelName => [modelName, 0]),
    );

    function queryPageOfRemainingDocuments(modelName: string): Record<string, unknown> {
        const queryCount = (queryCountByModel.get(modelName) ?? 0) + 1;
        queryCountByModel.set(modelName, queryCount);
        if (queryCount > MAX_QUERIES_PER_MODEL) {
            throw new Error(`Cleanup queried '${modelName}' ${queryCount} times without terminating`);
        }
        const remainingDocRefs = remainingDocRefsByModel.get(modelName) ?? [];
        return makeQueryResultForDocRefs(remainingDocRefs.slice(0, PAGE_SIZE_LIMIT));
    }

    function removeDocument(docRefString: string): void {
        if (!deleteRemovesDocument) { return; }
        const modelName = docRefString.split('/')[0]!;
        const remainingDocRefs = remainingDocRefsByModel.get(modelName) ?? [];
        remainingDocRefsByModel.set(modelName, remainingDocRefs.filter(remaining => remaining !== docRefString));
    }

    return {
        callRpc: async (_connector: unknown, method: string, params: Record<string, unknown>) => {
            if (method === 'QUERY') {
                const query = params['query'] as Record<string, unknown>;
                return queryPageOfRemainingDocuments(query['targetDocumentModel'] as string);
            }
            if (method === 'DELETE_DOCUMENT') {
                removeDocument(params['docRef'] as string);
            }
            return {};
        },
        remainingDocRefsOf: modelName => remainingDocRefsByModel.get(modelName) ?? [],
        queryCountOf: modelName => queryCountByModel.get(modelName) ?? 0,
    };
}

function seedDocRefStrings(modelName: string, count: number): string[] {
    return Array.from({length: count}, (_unused, index) => `${modelName}/doc-${index}`);
}

describe('cleanup', () => {
    let cleanup: CleanupRegistry;
    let mockCallRpc: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockCallRpc = vi.fn().mockResolvedValue({});

        vi.doMock('../../internal/rpc.js', () => ({callRpc: mockCallRpc}));

        vi.stubEnv('A12_SCRIPTING_TESTING_DOCUMENT_MODELS', 'ModelA_DM,ModelB_DM');
        vi.resetModules();

        const execCtxModule = await import('../../api/execution-contexts.js');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (execCtxModule.executionContext as any).init(mockConnector, TEST_AUTHORIZATION_HEADER);

        const cleanupModule = await import('../../testing/cleanup.js');
        cleanup = cleanupModule.cleanup;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.doUnmock('../../internal/rpc.js');
    });

    describe('afterEach', () => {
        it('should query each configured document model', async () => {
            // given
            cleanup.beforeEach();

            // when
            await cleanup.afterEach();

            // then
            expect(mockCallRpc).toHaveBeenCalledTimes(2);
            expect(mockCallRpc).toHaveBeenCalledWith(mockConnector, 'QUERY', expect.objectContaining({
                query: expect.objectContaining({targetDocumentModel: 'ModelA_DM'}),
            }));
            expect(mockCallRpc).toHaveBeenCalledWith(mockConnector, 'QUERY', expect.objectContaining({
                query: expect.objectContaining({targetDocumentModel: 'ModelB_DM'}),
            }));
        });

        it('should remove found documents', async () => {
            // given
            mockCallRpc.mockImplementation(async (_connector: unknown, _method: string, params: Record<string, unknown>) => {
                const query = params['query'] as Record<string, unknown>;
                return query?.['targetDocumentModel'] === 'ModelA_DM'
                    ? makeQueryResult('ModelA_DM/doc-1')
                    : {};
            });
            cleanup.beforeEach();

            // when
            await cleanup.afterEach();

            // then
            expect(mockCallRpc).toHaveBeenCalledWith(mockConnector, 'DELETE_DOCUMENT', {docRef: 'ModelA_DM/doc-1'});
        });

        it('should not remove documents when none found', async () => {
            // given
            cleanup.beforeEach();

            // when
            await cleanup.afterEach();

            // then
            expect(mockCallRpc).not.toHaveBeenCalledWith(mockConnector, 'DELETE_DOCUMENT', expect.anything());
        });

        it('should page through and delete every document, refetching only the remaining ones', async () => {
            // given
            const dataServices = createDataServicesDocumentStoreMock(DOCUMENT_COUNT_SPANNING_MULTIPLE_PAGES);
            mockCallRpc.mockImplementation(dataServices.callRpc);
            cleanup.beforeEach();

            // when
            await cleanup.afterEach();

            // then
            for (const modelName of CONFIGURED_DOCUMENT_MODEL_NAMES) {
                expect(dataServices.remainingDocRefsOf(modelName)).toEqual([]);
                expect(dataServices.queryCountOf(modelName)).toBe(EXPECTED_QUERY_COUNT_FOR_MULTIPLE_PAGES);
            }
        });

        it('should fail instead of looping forever when a full page of documents is not deleted', async () => {
            // given: deletes are silently ignored, so every query keeps returning the same full page
            const dataServices = createDataServicesDocumentStoreMock(PAGE_SIZE_LIMIT, {deleteRemovesDocument: false});
            mockCallRpc.mockImplementation(dataServices.callRpc);
            cleanup.beforeEach();

            // when / then
            await expect(cleanup.afterEach()).rejects.toThrow(/ModelA_DM.*made no progress/);
        });
    });

});
