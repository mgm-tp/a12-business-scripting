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

import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {ServerConnector} from '@com.mgmtp.a12.utils/utils-connector';

import {DocumentReference} from '../api/document-reference.js';
import {callRpc} from '../internal/rpc.js';
import {executionContext, TestContext} from "../api/execution-contexts";
import {A12} from "../api/facades/index.js";
import {UNINITIALIZED_TEST_CONTEXT_MESSAGE} from '../internal/constants.js';

import {TEST_AUTHORIZATION_HEADER} from './test-helpers.js';

vi.mock('../internal/rpc.js');

const DOCUMENT_MODEL_NAME = 'Project_DM';
const TASK_DOCUMENT_MODEL_NAME = 'Task_DM';
const SOURCE_DOC_REF_STRING = `${DOCUMENT_MODEL_NAME}/123`;
const CREATED_DOC_REF_STRING = `${DOCUMENT_MODEL_NAME}/456`;
const BATCH_DOC_REF_STRING_1 = `${DOCUMENT_MODEL_NAME}/1`;
const BATCH_DOC_REF_STRING_2 = `${TASK_DOCUMENT_MODEL_NAME}/2`;
const COPIED_DOC_REF_STRING = `${DOCUMENT_MODEL_NAME}/789`;
const LOCALE = 'de_DE'

const mockConnector: ServerConnector = { fetchData: vi.fn() };


describe("In TestContext", ()=> {
    describe('Documents.create', () => {
        beforeEach(() => {
            (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
            vi.mocked(callRpc).mockClear();
        });

        it('should call ADD_DOCUMENT RPC and return DocumentReference', async () => {
            // given
            vi.mocked(callRpc).mockResolvedValue({docRef: SOURCE_DOC_REF_STRING});

            // when
            const result = await A12.Documents.create(DOCUMENT_MODEL_NAME);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'ADD_DOCUMENT', {documentModelName: DOCUMENT_MODEL_NAME, document: {}});
            expect(result).toEqual(DocumentReference.fromString(SOURCE_DOC_REF_STRING));
        });

        it('should include document in params when provided', async () => {
            // given
            const doc = {root: {title: 'Test'}};
            vi.mocked(callRpc).mockResolvedValueOnce({docRef: CREATED_DOC_REF_STRING});

            // when
            await A12.Documents.create(DOCUMENT_MODEL_NAME, doc);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'ADD_DOCUMENT', {
                documentModelName: DOCUMENT_MODEL_NAME,
                document: doc,
            });
        });

        it('should return SimpleList of DocumentReferences for batch create', async () => {
            // given
            vi.mocked(callRpc).mockResolvedValueOnce({docRef: BATCH_DOC_REF_STRING_1}).mockResolvedValueOnce({docRef: BATCH_DOC_REF_STRING_2});

            // when
            const result = await A12.Documents.create([{documentModelName: DOCUMENT_MODEL_NAME}, {documentModelName: TASK_DOCUMENT_MODEL_NAME}]);

            // then
            expect(callRpc).toHaveBeenNthCalledWith(1, mockConnector, 'ADD_DOCUMENT', {documentModelName: DOCUMENT_MODEL_NAME, document: {}});
            expect(callRpc).toHaveBeenNthCalledWith(2, mockConnector, 'ADD_DOCUMENT', {documentModelName: TASK_DOCUMENT_MODEL_NAME, document: {}});
            const refs = result.toArray();
            expect(refs[0]).toEqual(DocumentReference.fromString(BATCH_DOC_REF_STRING_1));
            expect(refs[1]).toEqual(DocumentReference.fromString(BATCH_DOC_REF_STRING_2));
        });

        it('should throw when connector is not initialized', async () => {
            // given
            (executionContext as TestContext).reset();

            // when / then
            await expect(A12.Documents.create(DOCUMENT_MODEL_NAME)).rejects.toThrow(
                UNINITIALIZED_TEST_CONTEXT_MESSAGE,
            );
        });
    });

    describe('Documents.copy', () => {
        beforeEach(() => {
            (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        });

        it('should call COPY_DOCUMENT RPC and return new DocumentReference', async () => {
            // given
            const sourceDocRef = DocumentReference.fromString(SOURCE_DOC_REF_STRING);
            vi.mocked(callRpc).mockResolvedValue({docRef: COPIED_DOC_REF_STRING});

            // when
            const result = await A12.Documents.copy(sourceDocRef);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'COPY_DOCUMENT', {docRef: SOURCE_DOC_REF_STRING});
            expect(result).toEqual(DocumentReference.fromString(COPIED_DOC_REF_STRING));
        });

        it('should include locale in params when provided', async () => {
            // given
            const sourceDocRef = DocumentReference.fromString(SOURCE_DOC_REF_STRING);
            vi.mocked(callRpc).mockResolvedValue({docRef: COPIED_DOC_REF_STRING});

            // when
            await A12.Documents.copy(sourceDocRef, LOCALE);

            // then
            expect(callRpc).toHaveBeenCalledWith(mockConnector, 'COPY_DOCUMENT', {
                docRef: SOURCE_DOC_REF_STRING,
                locale: LOCALE
            });
        });

        it('should throw when connector is not initialized', async () => {
            // given
            (executionContext as TestContext).reset();
            const sourceDocRef = DocumentReference.fromString(SOURCE_DOC_REF_STRING);

            // when / then
            await expect(A12.Documents.copy(sourceDocRef)).rejects.toThrow(
                UNINITIALIZED_TEST_CONTEXT_MESSAGE,
            );
        });
    });

});
