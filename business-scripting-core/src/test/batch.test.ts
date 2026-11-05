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

import { describe, expect, it } from 'vitest';

import { DocumentReference } from '../api/document-reference.js';
import { executionContext } from '../api/execution-contexts.js';
import * as Batch from '../api/facades/batch/index.js';

const ANY_LOCALE = 'en';
const DOCUMENT_MODEL_NAME = 'DM';
const LINK_MODEL_NAME = 'RM';
const LINK_ROLE = 'role';
const LINK_SOURCE_ROLE = 'a';
const LINK_TARGET_ROLE = 'b';
const TEST_RELATIONSHIP_MODEL_NAME = 'TestRM';
const SOURCE_ROLE = 'source';
const TARGET_ROLE = 'target';
const LINK_ID_123 = 'link-123';
const SOURCE_DOCUMENT_MODEL_NAME = 'Source_DM';
const TARGET_DOCUMENT_MODEL_NAME = 'Target_DM';
const SOURCE_DOC_REF_STR = `${SOURCE_DOCUMENT_MODEL_NAME}/1`;
const TARGET_DOC_REF_STR = `${TARGET_DOCUMENT_MODEL_NAME}/2`;
const OTHER_DOCUMENT_MODEL_NAME = 'Other_DM';
const OTHER_DOC_REF_STR = `${OTHER_DOCUMENT_MODEL_NAME}/3`;
const LINK_ID_1 = 'link1';
const LINK_TYPE_CHILD = 'CHILD';

describe('A12.Batch', () => {
	describe('operation factories', () => {
		it('creates operations with correct method names', () => {
			const docRef = new DocumentReference(DOCUMENT_MODEL_NAME, '1');

			expect(Batch.Documents.create(DOCUMENT_MODEL_NAME).methodName).toBe('A12.Documents.create');
			expect(Batch.Documents.copy(docRef, ANY_LOCALE).methodName).toBe('A12.Documents.copy');
			expect(Batch.Documents.get(docRef).methodName).toBe('A12.Documents.get');
			expect(Batch.Documents.modify(docRef, {}, ANY_LOCALE).methodName).toBe('A12.Documents.modify');
			expect(Batch.Documents.remove(docRef, ANY_LOCALE).methodName).toBe('A12.Documents.remove');
			expect(Batch.Documents.find(DOCUMENT_MODEL_NAME).methodName).toBe('A12.Documents.find');
			expect(Batch.Links.find(LINK_MODEL_NAME, docRef, LINK_ROLE).methodName).toBe('A12.Links.find');
			expect(
				Batch.Links.create({
					relationshipModelName: LINK_MODEL_NAME,
					sourceRole: LINK_SOURCE_ROLE,
					targetRole: LINK_TARGET_ROLE,
					sourceDocRef: docRef,
					targetDocRef: docRef,
				}).methodName,
			).toBe('A12.Links.create');
			expect(
				Batch.Links.remove({
					id: '1',
					linkDescriptor: {
						relationshipModelName: LINK_MODEL_NAME,
						sourceRole: LINK_SOURCE_ROLE,
						targetRole: LINK_TARGET_ROLE,
						sourceDocRef: docRef,
						targetDocRef: docRef,
					},
				}).methodName,
			).toBe('A12.Links.remove');
			expect(Batch.Links.getLinkedDocuments(LINK_MODEL_NAME, docRef, LINK_ROLE).methodName).toBe('A12.Links.find');
		});
	});

	describe('transformResult', () => {
		it('Documents.create transforms docRef string to DocumentReference', () => {
			const op = Batch.Documents.create('MyDM');
			const rawResult = { docRef: 'MyDM/456' };

			const transformed = op.transformResult!(rawResult);

			expect(transformed).toBeInstanceOf(DocumentReference);
			expect(transformed.toString()).toBe('MyDM/456');
		});

		it('Documents.copy transforms docRef string to DocumentReference', () => {
			const sourceDocRef = new DocumentReference('MyDM', '123');
			const op = Batch.Documents.copy(sourceDocRef, ANY_LOCALE);
			const rawResult = { docRef: 'MyDM/789' };

			const transformed = op.transformResult!(rawResult);

			expect(transformed).toBeInstanceOf(DocumentReference);
			expect(transformed.toString()).toBe('MyDM/789');
		});

		it('Documents.find transforms docRef strings to SimpleList<DocumentReference>', () => {
			const op = Batch.Documents.find('Person_DM');
			const rawResult = ['Person_DM/123', 'Person_DM/456', 'Person_DM/789'];

			const transformed = op.transformResult!(rawResult);

			expect(transformed.size()).toBe(3);
			expect(transformed.get(0)).toBeInstanceOf(DocumentReference);
			expect(transformed.get(0)!.toString()).toBe('Person_DM/123');
			expect(transformed.get(1)!.toString()).toBe('Person_DM/456');
			expect(transformed.get(2)!.toString()).toBe('Person_DM/789');
		});

		it('Links.create transforms raw result to LinkId string', () => {
			const docRef = new DocumentReference(SOURCE_DOCUMENT_MODEL_NAME, '1');
			const op = Batch.Links.create({
				relationshipModelName: TEST_RELATIONSHIP_MODEL_NAME,
				sourceRole: SOURCE_ROLE,
				targetRole: TARGET_ROLE,
				sourceDocRef: docRef,
				targetDocRef: new DocumentReference(TARGET_DOCUMENT_MODEL_NAME, '2'),
			});

			const transformed = op.transformResult!(LINK_ID_123);
			expect(transformed).toBe(LINK_ID_123);
		});

		it('Links.remove converts linkDescriptor to DS format', () => {
			const op = Batch.Links.remove({
				id: LINK_ID_123,
				linkDescriptor: {
					relationshipModelName: TEST_RELATIONSHIP_MODEL_NAME,
					sourceRole: SOURCE_ROLE,
					targetRole: TARGET_ROLE,
					sourceDocRef: DocumentReference.fromString(SOURCE_DOC_REF_STR),
					targetDocRef: DocumentReference.fromString(TARGET_DOC_REF_STR),
				},
			});

			expect(op.params.linkSpec).toEqual({
				id: LINK_ID_123,
				linkDescriptor: {
					relationshipModel: TEST_RELATIONSHIP_MODEL_NAME,
					entities: [
						{ role: SOURCE_ROLE, docRef: SOURCE_DOC_REF_STR },
						{ role: TARGET_ROLE, docRef: TARGET_DOC_REF_STR },
					],
				},
			});
		});

		it('Links.find transforms link entries to SimpleList<RelationshipLinkSpec>', () => {
			const docRef = new DocumentReference(SOURCE_DOCUMENT_MODEL_NAME, '1');
			const op = Batch.Links.find(TEST_RELATIONSHIP_MODEL_NAME, docRef, SOURCE_ROLE);

			const rawResult = [
				{
					docRef: TARGET_DOC_REF_STR,
					type: LINK_TYPE_CHILD,
					depth: 1,
					document: null,
					linkId: LINK_ID_1,
					relationshipModel: TEST_RELATIONSHIP_MODEL_NAME,
					sourceRole: SOURCE_ROLE,
					sourceDocRef: SOURCE_DOC_REF_STR,
					targetRole: TARGET_ROLE,
					targetDocRef: TARGET_DOC_REF_STR,
				},
			];

			const transformed = op.transformResult!(rawResult);

			expect(transformed.size()).toBe(1);
			expect(transformed.get(0)!.id).toBe(LINK_ID_1);
			expect(transformed.get(0)!.linkDescriptor.relationshipModelName).toBe(TEST_RELATIONSHIP_MODEL_NAME);
			expect(transformed.get(0)!.linkDescriptor.sourceRole).toBe(SOURCE_ROLE);
			expect(transformed.get(0)!.linkDescriptor.targetRole).toBe(TARGET_ROLE);
			expect(transformed.get(0)!.linkDescriptor.sourceDocRef.toString()).toBe(SOURCE_DOC_REF_STR);
			expect(transformed.get(0)!.linkDescriptor.targetDocRef.toString()).toBe(TARGET_DOC_REF_STR);
		});

		it('Links.getLinkedDocuments transforms link entries to DocumentReference[]', () => {
			const docRef = new DocumentReference(SOURCE_DOCUMENT_MODEL_NAME, '1');
			const op = Batch.Links.getLinkedDocuments(TEST_RELATIONSHIP_MODEL_NAME, docRef, SOURCE_ROLE);

			const rawResult = [
				{
					docRef: TARGET_DOC_REF_STR,
					type: LINK_TYPE_CHILD,
					depth: 1,
					document: null,
					linkId: LINK_ID_1,
					relationshipModel: TEST_RELATIONSHIP_MODEL_NAME,
					sourceRole: SOURCE_ROLE,
					sourceDocRef: SOURCE_DOC_REF_STR,
					targetRole: TARGET_ROLE,
					targetDocRef: TARGET_DOC_REF_STR,
				},
				{
					docRef: OTHER_DOC_REF_STR,
					type: LINK_TYPE_CHILD,
					depth: 1,
					document: null,
					linkId: 'link2',
					relationshipModel: TEST_RELATIONSHIP_MODEL_NAME,
					sourceRole: SOURCE_ROLE,
					sourceDocRef: SOURCE_DOC_REF_STR,
					targetRole: TARGET_ROLE,
					targetDocRef: OTHER_DOC_REF_STR,
				},
			];

			const transformed = op.transformResult!(rawResult);

			expect(transformed.length).toBe(2);
			expect(transformed[0]!.toString()).toBe(TARGET_DOC_REF_STR);
			expect(transformed[1]!.toString()).toBe(OTHER_DOC_REF_STR);
		});

	});

	describe('call', () => {
		it('returns mock results for test context', () => {
			const op1 = Batch.Documents.create('MyDM');
			const op2 = Batch.Documents.create('MyOtherDM');
			const results = Batch.call(op1, op2);

			expect(results.get(op1)).toContain('mock result for');
			expect(results.get(op2)).toContain('mock result for');
		});

		it('retrieves results by operation reference', () => {
			const op1 = Batch.Documents.create('DM1');
			const op2 = Batch.Documents.get(DocumentReference.fromString('MyDM/1'));
			const results = Batch.call(op1, op2);

			// Each operation gets its own result
			expect(results.get(op1)).not.toBe(results.get(op2));
		});

		it('throws when getting result for unknown operation', () => {
			const op1 = Batch.Documents.create('DM1');
			const unknownOp = Batch.Documents.create('Unknown');
			const results = Batch.call(op1);

			expect(() => results.get(unknownOp)).toThrow('[Batch.call] Operation not found in results');
		});

		it('returns empty results for empty batch', () => {
			const results = Batch.call();
			expect(() => results.get(Batch.Documents.create(DOCUMENT_MODEL_NAME))).toThrow('[Batch.call] No operations were executed');
		});

		it('throws for unsupported execution context', () => {
			// Mock a full DS context (Batch.call only supports InEngineTaskContext)
			Object.assign(executionContext, {
				documentService: {},
				queryService: {},
                documentV2Serializer: {},
				relationshipLinkService: {},
				params: {},
			});

			const op = Batch.Documents.create('MyDM');
			expect(() => Batch.call(op)).toThrow('Batch.call is not supported in the current execution context.');
		});
	});
});
