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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServerConnector } from '@com.mgmtp.a12.utils/utils-connector';

import { DocumentReference } from '../api/document-reference.js';
import { getOrFail } from '../api/facades/documents/index.js';
import { SimpleList } from '../api/simple-list.js';
import * as ReadWrite from '../api/facades/documents/read-write.js';
import { DocumentNotFoundError } from '../api/errors.js';
import { DocumentV2 } from "../graaljs-compat-typings";
import { callRpc } from '../internal/rpc.js';
import { executionContext, TestContext } from "../api/execution-contexts";
import { A12 } from "../api/facades/index.js";
import { UNINITIALIZED_TEST_CONTEXT_MESSAGE } from '../internal/constants.js';

import { TEST_AUTHORIZATION_HEADER, mockDocumentV2 } from './test-helpers.js';

vi.mock('../internal/rpc.js');

const DOCUMENT_MODEL_NAME = 'Project_DM';
const WRITE_DOC_REF_STRING = `${DOCUMENT_MODEL_NAME}/1`;
const FIELD_PATH = '/Project/Name';
const FIELD_VALUE = 'Test';
const FIELD_DOCUMENT_PART = { path: FIELD_PATH, value: FIELD_VALUE, repetitions: [1, 1] };
const MODIFY_DOC_REF_STRING = `${DOCUMENT_MODEL_NAME}/1`;
const MODIFY_DOC_REF_STRING_2 = `${DOCUMENT_MODEL_NAME}/2`;
const MODIFY_DOCUMENT = { Project: { Name: 'Modified Name' } };
const LOCALE = 'de_DE'

const mockConnector: ServerConnector = { fetchData: vi.fn() };

describe(`Document.getOrFail()`, () => {
    const validDocumentModelName = "someDocumentModel";
    const invalidDocumentModelName = "someInvalidDocumentModel";
	const validDocRef1 = new DocumentReference(validDocumentModelName, '1');
    const validDocRef2 = new DocumentReference(validDocumentModelName, '2');
	const invalidDocRef = new DocumentReference(invalidDocumentModelName, '404');
	const emptyDocRefList = Array<DocumentReference>();
	const validDocRefList = [validDocRef1, validDocRef2];
	const invalidDocRefList = [validDocRef1, invalidDocRef];

	const mockDoc1= mockDocumentV2([], validDocumentModelName);
    const mockDoc2 = mockDocumentV2([], validDocumentModelName)

	vi.spyOn(ReadWrite, 'get').mockImplementation(((docRefOrRefs: DocumentReference | DocumentReference[]): Promise<DocumentV2|undefined|SimpleList<DocumentV2|undefined>> => {
		switch (docRefOrRefs) {
			case validDocRef1:
				return Promise.resolve(mockDoc1);
			case invalidDocRef:
				return Promise.resolve(undefined);
			case emptyDocRefList:
				return Promise.resolve(new SimpleList([]));
			case validDocRefList:
				return Promise.resolve(new SimpleList([mockDoc1, mockDoc2]));
			case invalidDocRefList:
				return Promise.resolve(new SimpleList([mockDoc1, undefined]));
			default:
				throw Error(`MockImplementation for A12.Document.get does not cover parameters: ${docRefOrRefs}`);
		}
	}) as typeof ReadWrite.get);

    describe("Error thrown on undefined", ()=>{
        it('has correct error message', async () => {
            await expect(async () => {
                await getOrFail(invalidDocRef);
            }).rejects.toThrow(
                "[Documents.getOrFail] getOrFail(someInvalidDocumentModel/404) - " +
                "The provided element must not be undefined!"
            );
        });

        it('has correct error type', async () => {
            await expect(async () => {
                await getOrFail(invalidDocRef);
            }).rejects.toThrow(DocumentNotFoundError);
        });
    })

	it('passes on valid docRef ', async () => {
		expect(await getOrFail(validDocRef1)).toBe(mockDoc1);
	});

    describe('Error thrown on fewer results than requested docRefs', ()=> {
        it('has the correct error message', async () => {
            await expect(async () => {
                await getOrFail(invalidDocRefList);
            }).rejects.toThrow(
                '[Documents.getOrFail] getOrFail([someDocumentModel/1,someInvalidDocumentModel/404]) -' +
                    ' The provided element must not have an unexpected size! Expected 2, got 1.')
        });

        it('has the correct error type', async () => {
            await expect(async () => {
                await getOrFail(invalidDocRefList);
            }).rejects.toThrow(DocumentNotFoundError)
        });
    })

    describe('Error thrown on empty document list',()=>{
        it('has the correct error message', async () => {
            await expect(async () => {
                await getOrFail(emptyDocRefList);
            }).rejects.toThrow('[Documents.getOrFail] getOrFail([]) - The provided element must not be an empty list!');
        });

        it('has the correct error type', async () => {
            await expect(async () => {
                await getOrFail(emptyDocRefList);
            }).rejects.toThrow(DocumentNotFoundError);
        });
    })

	it('passes on valid docRefList ', async () => {
		expect(await getOrFail(validDocRefList)).toStrictEqual(new SimpleList([mockDoc1, mockDoc2]));
	});
});

describe('Documents.writeFields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
    });

    it('should call PARTIAL_MODIFY_DOCUMENT RPC with docRef and document parts', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when
        await A12.Documents.writeFields(docRef, [{field: FIELD_PATH, value: FIELD_VALUE}]);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'PARTIAL_MODIFY_DOCUMENT', {
            docRef: WRITE_DOC_REF_STRING,
            documentPart: [FIELD_DOCUMENT_PART],
            locale: null,
        });
    });

    it('should include locale in params when provided', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when
        await A12.Documents.writeFields(docRef, [{field: FIELD_PATH, value: FIELD_VALUE}],LOCALE);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'PARTIAL_MODIFY_DOCUMENT', {
            docRef: WRITE_DOC_REF_STRING,
            documentPart: [FIELD_DOCUMENT_PART],
            locale: LOCALE,
        });
    });

    it('should not call RPC when fields list is empty', async () => {
        // given
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when
        await A12.Documents.writeFields(docRef, []);

        // then
        expect(callRpc).not.toHaveBeenCalled();
    });

    it('should throw when connector is not initialized', async () => {
        // given
        (executionContext as TestContext).reset();
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when / then
        await expect(
            A12.Documents.writeFields(docRef, [{field: FIELD_PATH, value: FIELD_VALUE}]),
        ).rejects.toThrow(UNINITIALIZED_TEST_CONTEXT_MESSAGE);
    });
});

describe('Documents.writeAsJson', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
    });

    it('should call PARTIAL_MODIFY_DOCUMENT RPC with docRef and document parts', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when
        await A12.Documents.writeAsJson(docRef, '/Project', {Name: FIELD_VALUE});

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'PARTIAL_MODIFY_DOCUMENT', {
            docRef: WRITE_DOC_REF_STRING,
            documentPart: [FIELD_DOCUMENT_PART],
            locale: null,
        });
    });

    it('should include locale in params when provided', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when
        await A12.Documents.writeAsJson(docRef, '/Project', {Name: FIELD_VALUE}, LOCALE);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'PARTIAL_MODIFY_DOCUMENT', {
            docRef: WRITE_DOC_REF_STRING,
            documentPart: [FIELD_DOCUMENT_PART],
            locale: LOCALE,
        });
    });

    it('should throw when connector is not initialized', async () => {
        // given
        (executionContext as TestContext).reset();
        const docRef = DocumentReference.fromString(WRITE_DOC_REF_STRING);

        // when / then
        await expect(
            A12.Documents.writeAsJson(docRef, '/Project', {Name: FIELD_VALUE}),
        ).rejects.toThrow(UNINITIALIZED_TEST_CONTEXT_MESSAGE);
    });
});

describe('Documents.modify', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
    });

    it('should call MODIFY_DOCUMENT RPC with docRef and document', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef = DocumentReference.fromString(MODIFY_DOC_REF_STRING);

        // when
        await A12.Documents.modify(docRef, MODIFY_DOCUMENT);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'MODIFY_DOCUMENT', {
            docRef: MODIFY_DOC_REF_STRING,
            document: MODIFY_DOCUMENT,
            locale: null,
        });
    });

    it('should include locale in params when provided', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef = DocumentReference.fromString(MODIFY_DOC_REF_STRING);

        // when
        await A12.Documents.modify(docRef, MODIFY_DOCUMENT, LOCALE);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'MODIFY_DOCUMENT', {
            docRef: MODIFY_DOC_REF_STRING,
            document: MODIFY_DOCUMENT,
            locale: LOCALE,
        });
    });

    it('should throw when connector is not initialized', async () => {
        // given
        (executionContext as TestContext).reset();
        const docRef = DocumentReference.fromString(MODIFY_DOC_REF_STRING);

        // when / then
        await expect(A12.Documents.modify(docRef, MODIFY_DOCUMENT)).rejects.toThrow(
            UNINITIALIZED_TEST_CONTEXT_MESSAGE,
        );
    });

    it('should call MODIFY_DOCUMENT RPC for each document in batch', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef1 = DocumentReference.fromString(MODIFY_DOC_REF_STRING);
        const docRef2 = DocumentReference.fromString(MODIFY_DOC_REF_STRING_2);

        // when
        await A12.Documents.modify([
            {docRef: docRef1, document: MODIFY_DOCUMENT},
            {docRef: docRef2, document: MODIFY_DOCUMENT},
        ]);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'MODIFY_DOCUMENT', {
            docRef: MODIFY_DOC_REF_STRING,
            document: MODIFY_DOCUMENT,
            locale: null,
        });
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'MODIFY_DOCUMENT', {
            docRef: MODIFY_DOC_REF_STRING_2,
            document: MODIFY_DOCUMENT,
            locale: null,
        });
    });

    it('should include locale for each document in batch', async () => {
        // given
        vi.mocked(callRpc).mockResolvedValue({});
        const docRef1 = DocumentReference.fromString(MODIFY_DOC_REF_STRING);
        const docRef2 = DocumentReference.fromString(MODIFY_DOC_REF_STRING_2);

        // when
        await A12.Documents.modify([
            {docRef: docRef1, document: MODIFY_DOCUMENT},
            {docRef: docRef2, document: MODIFY_DOCUMENT},
        ], LOCALE);

        // then
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'MODIFY_DOCUMENT', {
            docRef: MODIFY_DOC_REF_STRING,
            document: MODIFY_DOCUMENT,
            locale: LOCALE,
        });
        expect(callRpc).toHaveBeenCalledWith(mockConnector, 'MODIFY_DOCUMENT', {
            docRef: MODIFY_DOC_REF_STRING_2,
            document: MODIFY_DOCUMENT,
            locale: LOCALE,
        });
    });

    it('should throw when connector is not initialized in batch', async () => {
        // given
        (executionContext as TestContext).reset();
        const docRef = DocumentReference.fromString(MODIFY_DOC_REF_STRING);

        // when / then
        await expect(
            A12.Documents.modify([{docRef, document: MODIFY_DOCUMENT}]),
        ).rejects.toThrow(UNINITIALIZED_TEST_CONTEXT_MESSAGE);
    });
});
