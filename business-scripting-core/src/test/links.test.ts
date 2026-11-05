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

import {DocumentReference} from '../api/document-reference.js';
import {callRpc, callRpcBatch} from '../internal/rpc.js';
import {executionContext, TestContext} from '../api/execution-contexts.js';
import {A12} from '../api/facades/index.js';
import {SimpleList} from '../api/simple-list.js';
import {LinkSpecMismatchError} from '../api/errors.js';
import {UNINITIALIZED_TEST_CONTEXT_MESSAGE} from '../internal/constants.js';

import {TEST_AUTHORIZATION_HEADER} from './test-helpers.js';

vi.mock('../internal/rpc.js');

const mockConnector: ServerConnector = { fetchData: vi.fn() };

const PROJECT_DM = 'Project_DM';
const EMPLOYEE_DM = 'Employee_DM'
const RM_NAME = 'Project_Employee_RM';
const SOURCE_ROLE = 'Project';
const TARGET_ROLE = 'Employee';
const LINK_ID = 'link-1';
const LINK_ID_2 = 'link-2';

const projectDocRef = new DocumentReference(PROJECT_DM, "1");
const employeeDocRef = new DocumentReference(EMPLOYEE_DM, '1');
const employeeDocRef2 = new DocumentReference(EMPLOYEE_DM, '2');

const linkDescriptor = {
    relationshipModelName: RM_NAME,
    sourceRole: SOURCE_ROLE,
    sourceDocRef: projectDocRef,
    targetRole: TARGET_ROLE,
    targetDocRef: employeeDocRef,
};

const expectedDsLinkDescriptor = {
    relationshipModel: RM_NAME,
    entities: [
        { role: SOURCE_ROLE, docRef: projectDocRef.toString() },
        { role: TARGET_ROLE, docRef: employeeDocRef.toString() },
    ],
};


describe('In TestContext',() => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Links.create', () => {
        beforeEach(() => {
            (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        });

        it('should call ADD_LINK RPC and return link ID', async () => {
            // given
            vi.mocked(callRpc).mockResolvedValue({id: LINK_ID});

            // when
            const result = await A12.Links.create(linkDescriptor);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'ADD_LINK', {
                linkDescriptor: expectedDsLinkDescriptor,
            });
            expect(result).toBe(LINK_ID);
        });

        it('should include linkDocument in params when provided', async () => {
            // given
            // A plain object is accepted directly as link document (no DocumentV2 needed).
            const linkDoc = {Assignment: {Allocation: 50}};
            vi.mocked(callRpc).mockResolvedValue({id: LINK_ID});

            // when
            await A12.Links.create(linkDescriptor, linkDoc);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'ADD_LINK', {
                linkDescriptor: expectedDsLinkDescriptor,
                linkDocument: linkDoc,
            });
        });

        it('should return SimpleList of link IDs for batch create with and without plain object link document', async () => {
            // given
            const linkDoc = {Assignment: {Allocation: 50}};
            vi.mocked(callRpc)
                .mockResolvedValueOnce({id: LINK_ID})
                .mockResolvedValueOnce({id: LINK_ID_2});

            // when
            const result = await A12.Links.create([{linkDescriptor, linkDocument: linkDoc}, {linkDescriptor}]);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'ADD_LINK', {
                linkDescriptor: expectedDsLinkDescriptor,
                linkDocument: linkDoc,
            });
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'ADD_LINK', {
                linkDescriptor: expectedDsLinkDescriptor,
            });
            expect(result.toArray()).toEqual([LINK_ID, LINK_ID_2]);
        });

        it('should throw when connector is not initialized', async () => {
            // given
            (executionContext as TestContext).reset();

            // when / then
            await expect(A12.Links.create(linkDescriptor)).rejects.toThrow(
                UNINITIALIZED_TEST_CONTEXT_MESSAGE,
            );
        });
    });

    describe('Links.find', () => {
        beforeEach(() => {
            (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        });

        it('should call QUERY RPC and return parsed link specs', async () => {
            // given
            const rpcEntry = {
                docRef:employeeDocRef.toString(),
                type: 'CHILD',
                depth: 1,
                document: null,
                linkId: LINK_ID,
                relationshipModel: RM_NAME,
                sourceRole: SOURCE_ROLE,
                sourceDocRef: projectDocRef.toString(),
                targetRole: TARGET_ROLE,
                targetDocRef: employeeDocRef.toString(),
            };
            vi.mocked(callRpc).mockResolvedValue({links: [rpcEntry]});

            // when
            const result = await A12.Links.find(RM_NAME, projectDocRef, TARGET_ROLE);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'QUERY', {
                query: {
                    targetDocumentModel: PROJECT_DM,
                    projectionName: 'document',
                    links: [{ relationshipModel: RM_NAME, targetRole: TARGET_ROLE, maxDepth: 1 }],
                    constraint: {
                        operator: 'exact_match',
                        field: '/__meta/docRef',
                        value: projectDocRef.toString(),
                    },
                    paging: {pageNumber: 0, pageSize: 100},
                },
            });
            const specs = result.toArray();
            expect(specs).toHaveLength(1);
            expect(specs[0]!.id).toBe(LINK_ID);
            expect(specs[0]!.linkDescriptor.targetDocRef).toEqual(employeeDocRef);
        });

        it('should return empty list when no links found', async () => {
            // given
            vi.mocked(callRpc).mockResolvedValue({links: []});

            // when
            const result = await A12.Links.find(RM_NAME, projectDocRef, TARGET_ROLE);

            // then
            expect(result.toArray()).toHaveLength(0);
        });

        it('should throw when connector is not initialized', async () => {
            // given
            (executionContext as TestContext).reset();

            // when / then
            await expect(A12.Links.find(RM_NAME, projectDocRef, TARGET_ROLE)).rejects.toThrow(
                UNINITIALIZED_TEST_CONTEXT_MESSAGE,
            );
        });
    });

    describe('Links.getLinkedDocuments', () => {
        beforeEach(() => {
            (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        });

        it('should return a DocumentReference if a linked document exists', async () => {
            // given
            const rpcEntry = {
                docRef: employeeDocRef.toString(),
                type: 'CHILD',
                depth: 1,
                document: null,
                linkId: LINK_ID,
                relationshipModel: RM_NAME,
                sourceRole: SOURCE_ROLE,
                sourceDocRef: projectDocRef.toString(),
                targetRole: TARGET_ROLE,
                targetDocRef: employeeDocRef.toString(),
            };
            vi.mocked(callRpc).mockResolvedValue({links: [rpcEntry]});

            // when
            const result = await A12.Links.getLinkedDocuments(RM_NAME, projectDocRef, TARGET_ROLE);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'QUERY', {
                query: {
                    targetDocumentModel: PROJECT_DM,
                    projectionName: 'document',
                    links: [{relationshipModel: RM_NAME, targetRole: TARGET_ROLE, maxDepth: 1}],
                    constraint: {
                        operator: 'exact_match',
                        field: '/__meta/docRef',
                        value: projectDocRef.toString(),
                    },
                    paging: {pageNumber: 0, pageSize: 100},
                },
            });
            const docRefs = result.toArray();
            expect(docRefs).toHaveLength(1);
            expect(docRefs[0]).toEqual(employeeDocRef);
        });

        it('should return all DocumentReferences when multiple links exist', async () => {
            // given
            const makeRpcEntry = (targetDocRef: DocumentReference, linkId: string) => ({
                docRef: targetDocRef.toString(),
                type: 'CHILD',
                depth: 1,
                document: null,
                linkId,
                relationshipModel: RM_NAME,
                sourceRole: SOURCE_ROLE,
                sourceDocRef: projectDocRef.toString(),
                targetRole: TARGET_ROLE,
                targetDocRef: targetDocRef.toString(),
            });
            vi.mocked(callRpc).mockResolvedValue({
                links: [makeRpcEntry(employeeDocRef, LINK_ID), makeRpcEntry(employeeDocRef2, LINK_ID_2)],
            });

            // when
            const result = await A12.Links.getLinkedDocuments(RM_NAME, projectDocRef, TARGET_ROLE);

            // then
            const docRefs = result.toArray();
            expect(docRefs).toHaveLength(2);
            expect(docRefs[0]).toEqual(employeeDocRef);
            expect(docRefs[1]).toEqual(employeeDocRef2);
        });

        it('should return empty list when no links found', async () => {
            // given
            vi.mocked(callRpc).mockResolvedValue({links: []});

            // when
            const result = await A12.Links.getLinkedDocuments(RM_NAME, projectDocRef, TARGET_ROLE);

            // then
            expect(result.toArray()).toHaveLength(0);
        });

        it('should throw when connector is not initialized', async () => {
            // given
            (executionContext as TestContext).reset();

            // when / then
            await expect(A12.Links.getLinkedDocuments(RM_NAME, projectDocRef, TARGET_ROLE)).rejects.toThrow(
                UNINITIALIZED_TEST_CONTEXT_MESSAGE,
            );
        });
    });

    describe('Links.remove', () => {
        beforeEach(() => {
            (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        });

        const linkSpec = {id: LINK_ID, linkDescriptor};

        it('should send a single link spec as a DELETE_LINK batch of one', async () => {
            // given
            vi.mocked(callRpcBatch).mockResolvedValue([{}]);

            // when
            await A12.Links.remove(linkSpec);

            // then
            expect(callRpcBatch).toHaveBeenCalledExactlyOnceWith(mockConnector, [
                {method: 'DELETE_LINK', params: {linkRef: {id: LINK_ID, linkDescriptor: expectedDsLinkDescriptor}}},
            ]);
        });

        it('should send all link specs of a list in one DELETE_LINK batch', async () => {
            // given
            const linkSpec2 = {id: LINK_ID_2, linkDescriptor};
            vi.mocked(callRpcBatch).mockResolvedValue([{}, {}]);

            // when
            await A12.Links.remove([linkSpec, linkSpec2]);

            // then
            expect(callRpcBatch).toHaveBeenCalledExactlyOnceWith(mockConnector, [
                {method: 'DELETE_LINK', params: {linkRef: {id: LINK_ID, linkDescriptor: expectedDsLinkDescriptor}}},
                {method: 'DELETE_LINK', params: {linkRef: {id: LINK_ID_2, linkDescriptor: expectedDsLinkDescriptor}}},
            ]);
            expect(callRpc).not.toHaveBeenCalled();
        });

        it('should reject with LinkSpecMismatchError when DELETE_LINK reports a mismatching spec', async () => {
            // given
            vi.mocked(callRpcBatch).mockRejectedValue(new Error(
                'DELETE_LINK returned error: {"code":-32015,"message":"Wrong Entity","data":{"description":' +
                `{"default":"Requested link [${LINK_ID}] has role:docRef [Employee:Employee_DM/1]"}}}`,
            ));

            // when / then
            await expect(A12.Links.remove(linkSpec)).rejects.toBeInstanceOf(LinkSpecMismatchError);
        });

        it('should throw when connector is not initialized', async () => {
            // given
            (executionContext as TestContext).reset();

            // when / then
            await expect(A12.Links.remove(linkSpec)).rejects.toThrow(
                UNINITIALIZED_TEST_CONTEXT_MESSAGE,
            );
        });
    });
});

describe('In WorkflowContext', () => {
    // A workflow context is detected purely by the presence of a dataServicesRpcFacade.
    const mockFacade = {
        tryAddLink: vi.fn(),
        batchCall: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(executionContext, {dataServicesRpcFacade: mockFacade});
    });

    afterEach(() => {
        delete (executionContext as unknown as Record<string, unknown>).dataServicesRpcFacade;
    });

    describe('Links.create', () => {
        it('should pass a plain-object link document to tryAddLink for single input', async () => {
            // given
            // A plain object is accepted directly as link document (no DocumentV2 needed);
            // the RPC facade serializes it on the Kotlin side.
            const linkDoc = {Assignment: {Allocation: 50}};
            mockFacade.tryAddLink.mockReturnValue(LINK_ID);

            // when
            const result = await A12.Links.create(linkDescriptor, linkDoc);

            // then
            expect(mockFacade.batchCall).not.toHaveBeenCalled();
            expect(mockFacade.tryAddLink).toHaveBeenCalledWith(expectedDsLinkDescriptor, linkDoc);
            expect(result).toBe(LINK_ID);
        });

        it('should return a SimpleList for a single-element array input', async () => {
            // given
            mockFacade.batchCall.mockReturnValue([LINK_ID]);

            // when
            const result = await A12.Links.create([{linkDescriptor}]);

            // then the array overload must return a SimpleList, not a bare LinkId
            expect(mockFacade.tryAddLink).not.toHaveBeenCalled();
            expect(result).toBeInstanceOf(SimpleList);
            expect(result.toArray()).toEqual([LINK_ID]);
        });

        it('should route plain-object link documents through the batch path for array input', async () => {
            // given
            mockFacade.batchCall.mockReturnValue([LINK_ID, LINK_ID_2]);

            // when
            const result = await A12.Links.create([
                {linkDescriptor, linkDocument: {a: 1}},
                {linkDescriptor, linkDocument: {b: 2}},
            ]);

            // then
            const batch = mockFacade.batchCall.mock.calls[0]![0] as {params: Record<string, unknown>}[];
            expect(batch[0]!.params.linkDocument).toEqual({a: 1});
            expect(batch[1]!.params.linkDocument).toEqual({b: 2});
            expect(result.toArray()).toEqual([LINK_ID, LINK_ID_2]);
        });
    });
});
