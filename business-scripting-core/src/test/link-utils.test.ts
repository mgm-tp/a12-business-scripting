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

import { describe, it, expect } from 'vitest';

import {
	toDsLinkDescriptor,
	passesLinkedDocRefsFilter,
	rpcResultsToLinkSpecs,
	dsResultsToLinkSpecs,
} from '../internal/link-utils.js';
import { DocumentReference } from '../index.js';
import { DocumentTreeResult, DocumentTreeResultJson, JavaList } from '../graaljs-compat-typings/index.js';

const RELATIONSHIP_MODEL_NAME = 'Project_Employee_RM';
const PROJECT_ROLE = 'Project';
const EMPLOYEE_ROLE = 'Employee';
const SOURCE_DOC_REF_STR = 'Project/1';
const EMPLOYEE_A_DOC_REF_STR = 'Employee/A';
const EMPLOYEE_B_DOC_REF_STR = 'Employee/B';
const LINK_ID_1 = 'link1';
const LINK_ID_2 = 'link2';
const ENTRY_TYPE_CHILD = 'CHILD';
const ENTRY_TYPE_ROOT = 'ROOT';
const ENTRY_TYPE_LINK = 'LINK';
const LINK_ID_3 = 'link3';
const ALT_SOURCE_DOC_REF_STR = 'Project/2';
const LINK_DOC_REF_STR = 'LinkDoc/1';

// =============================================================================
// Helpers for dsResultsToLinkSpecs tests
// =============================================================================

interface MockDsEntryOptions {
	type: 'ROOT' | 'CHILD' | 'LINK';
	docRef: string;
	linkId?: string;
	relationshipModel?: string;
	sourceRole?: string;
	targetRole?: string;
	sourceDocRef?: string;
	targetDocRef?: string;
}

function makeDsEntry(opts: MockDsEntryOptions): DocumentTreeResult {
	return {
		getType: () => ({ toString: () => opts.type, name: () => opts.type, ordinal: () => 0 }),
		getDocRef: () => DocumentReference.fromString(opts.docRef),
		getDocumentModelName: () => opts.docRef.split('/')[0]!,
		getDepth: () => 0,
		getDocument: () => ({ toString: () => '{}' }),
		getLinkId: () => opts.linkId ?? null,
		getRelationshipModel: () => opts.relationshipModel ?? null,
		getSourceRole: () => opts.sourceRole ?? null,
		getTargetRole: () => opts.targetRole ?? null,
		getSourceDocRef: () => (opts.sourceDocRef ? DocumentReference.fromString(opts.sourceDocRef) : null),
		getTargetDocRef: () => (opts.targetDocRef ? DocumentReference.fromString(opts.targetDocRef) : null),
		getBackReference: () => null,
	} as unknown as DocumentTreeResult;
}

function makeJavaList<T>(items: T[]): JavaList<T> {
	return {
		size: () => items.length,
		get: (i: number) => items[i]!,
	} as JavaList<T>;
}

describe('toDsLinkDescriptor', () => {
	it('converts RelationshipLinkDescriptor to plain object format', () => {
		const input = {
			relationshipModelName: RELATIONSHIP_MODEL_NAME,
			sourceRole: 'project',
			targetRole: 'employee',
			sourceDocRef: DocumentReference.fromString('Project_DM/1'),
			targetDocRef: DocumentReference.fromString('Employee_DM/2'),
		};

		const result = toDsLinkDescriptor(input);

		expect(result).toEqual({
			relationshipModel: RELATIONSHIP_MODEL_NAME,
			entities: [
				{ role: 'project', docRef: 'Project_DM/1' },
				{ role: 'employee', docRef: 'Employee_DM/2' },
			],
		});
	});
});

describe('passesLinkedDocRefsFilter', () => {
	const docRefA = DocumentReference.fromString('A_DM/1');
	const docRefB = DocumentReference.fromString('B_DM/2');
	const docRefC = DocumentReference.fromString('C_DM/3');

	it('returns true when no filter provided', () => {
		expect(passesLinkedDocRefsFilter(docRefA)).toBe(true);
		expect(passesLinkedDocRefsFilter(docRefA, undefined)).toBe(true);
	});

	it('returns true when filter is empty array', () => {
		expect(passesLinkedDocRefsFilter(docRefA, [])).toBe(true);
	});

	it('returns true when docRef matches filter', () => {
		expect(passesLinkedDocRefsFilter(docRefA, [docRefA])).toBe(true);
		expect(passesLinkedDocRefsFilter(docRefA, [docRefA, docRefB])).toBe(true);
	});

	it('returns false when docRef not in filter', () => {
		expect(passesLinkedDocRefsFilter(docRefA, [docRefB])).toBe(false);
		expect(passesLinkedDocRefsFilter(docRefA, [docRefB, docRefC])).toBe(false);
	});
});

describe('rpcResultsToLinkSpecs', () => {
	const sourceDocRef = DocumentReference.fromString(SOURCE_DOC_REF_STR);
	const targetDocRefA = DocumentReference.fromString(EMPLOYEE_A_DOC_REF_STR);
	const targetDocRefB = DocumentReference.fromString(EMPLOYEE_B_DOC_REF_STR);

	const makeChildEntry = (linkId: string, employeeDocRef: string): DocumentTreeResultJson => ({
		docRef: employeeDocRef,
		type: ENTRY_TYPE_CHILD,
		depth: 1,
		document: null,
		linkId,
		relationshipModel: RELATIONSHIP_MODEL_NAME,
		sourceRole: PROJECT_ROLE,
		sourceDocRef: SOURCE_DOC_REF_STR,
		targetRole: EMPLOYEE_ROLE,
		targetDocRef: employeeDocRef,
	});

	const makeLinkEntry = (linkId: string, linkDocRef: string): DocumentTreeResultJson => ({
		docRef: linkDocRef,
		type: ENTRY_TYPE_LINK,
		depth: 1,
		document: null,
		linkId,
		relationshipModel: RELATIONSHIP_MODEL_NAME,
		sourceRole: PROJECT_ROLE,
		sourceDocRef: SOURCE_DOC_REF_STR,
		targetRole: EMPLOYEE_ROLE,
		targetDocRef: linkDocRef,
	});

	const entries = [makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR), makeChildEntry(LINK_ID_2, EMPLOYEE_B_DOC_REF_STR)];

	it('converts CHILD entries to RelationshipLinkSpec array', () => {
		const result = rpcResultsToLinkSpecs(entries, sourceDocRef);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe(LINK_ID_1);
		expect(result[0].linkDescriptor).toEqual({
			relationshipModelName: RELATIONSHIP_MODEL_NAME,
			sourceRole: PROJECT_ROLE,
			sourceDocRef: sourceDocRef,
			targetRole: EMPLOYEE_ROLE,
			targetDocRef: targetDocRefA,
		});
	});

	it('skips ROOT and LINK type entries as specs, uses LINK node to populate linkDocRef', () => {
		// given
		const mixed: DocumentTreeResultJson[] = [
			{ docRef: SOURCE_DOC_REF_STR, type: ENTRY_TYPE_ROOT, depth: 0, document: null },
			makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR),
			makeLinkEntry(LINK_ID_1, LINK_DOC_REF_STR),
		];

		// when
		const result = rpcResultsToLinkSpecs(mixed, sourceDocRef);

		// then
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(LINK_ID_1);
		expect(result[0].linkDocRef).toEqual(DocumentReference.fromString(LINK_DOC_REF_STR));
	});

	it('sets linkDocRef to undefined when no LINK node exists for the link', () => {
		// given / when
		const result = rpcResultsToLinkSpecs(entries, sourceDocRef);

		// then
		expect(result[0].linkDocRef).toBeUndefined();
		expect(result[1].linkDocRef).toBeUndefined();
	});

	it('resolves roles correctly when queried document is in target role', () => {
		// given
		const entry: DocumentTreeResultJson = {
			docRef: ALT_SOURCE_DOC_REF_STR,
			type: ENTRY_TYPE_CHILD,
			depth: 1,
			document: null,
			linkId: LINK_ID_3,
			relationshipModel: RELATIONSHIP_MODEL_NAME,
			sourceRole: PROJECT_ROLE,
			sourceDocRef: ALT_SOURCE_DOC_REF_STR,
			targetRole: EMPLOYEE_ROLE,
			targetDocRef: EMPLOYEE_B_DOC_REF_STR,
		};
		const employeeDocRef = DocumentReference.fromString(EMPLOYEE_B_DOC_REF_STR);

		// when
		const result = rpcResultsToLinkSpecs([entry], employeeDocRef);

		// then — docRef (Employee/B) matches targetDocRef, so it is the target side
		expect(result[0].linkDescriptor.sourceRole).toBe(EMPLOYEE_ROLE);
		expect(result[0].linkDescriptor.targetRole).toBe(PROJECT_ROLE);
		expect(result[0].linkDescriptor.targetDocRef.toString()).toBe(ALT_SOURCE_DOC_REF_STR);
	});

	it('filters by linkedDocRefs', () => {
		const result = rpcResultsToLinkSpecs(entries, sourceDocRef, [targetDocRefB]);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(LINK_ID_2);
	});

	it('returns empty array when no matches', () => {
		const noMatch = DocumentReference.fromString('NoMatch/1');
		const result = rpcResultsToLinkSpecs(entries, sourceDocRef, [noMatch]);

		expect(result).toHaveLength(0);
	});

	it('handles empty input', () => {
		const result = rpcResultsToLinkSpecs([], sourceDocRef);

		expect(result).toHaveLength(0);
	});

	describe('skips CHILD entries with missing required fields', () => {
		it('skips entry missing linkId', () => {
			// given
			const entry: DocumentTreeResultJson = {
				...makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR),
				linkId: undefined,
			};

			// when
			const result = rpcResultsToLinkSpecs([entry], sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('skips entry missing relationshipModel', () => {
			// given
			const entry: DocumentTreeResultJson = {
				...makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR),
				relationshipModel: undefined,
			};

			// when
			const result = rpcResultsToLinkSpecs([entry], sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('skips entry where both roles are undefined', () => {
			// given
			const entry: DocumentTreeResultJson = {
				...makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR),
				sourceRole: undefined,
				targetRole: undefined,
			};

			// when
			const result = rpcResultsToLinkSpecs([entry], sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('skips entry missing sourceDocRef', () => {
			// given
			const entry: DocumentTreeResultJson = {
				...makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR),
				sourceDocRef: undefined,
			};

			// when
			const result = rpcResultsToLinkSpecs([entry], sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('keeps valid sibling entries when one entry is skipped', () => {
			// given
			const invalid: DocumentTreeResultJson = { ...makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR), linkId: undefined };
			const valid = makeChildEntry(LINK_ID_2, EMPLOYEE_B_DOC_REF_STR);

			// when
			const result = rpcResultsToLinkSpecs([invalid, valid], sourceDocRef);

			// then
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(LINK_ID_2);
		});
	});
});

describe('dsResultsToLinkSpecs', () => {
	const sourceDocRef = DocumentReference.fromString(SOURCE_DOC_REF_STR);
	const targetDocRefA = DocumentReference.fromString(EMPLOYEE_A_DOC_REF_STR);
	const targetDocRefB = DocumentReference.fromString(EMPLOYEE_B_DOC_REF_STR);

	const makeChildEntry = (linkId: string, employeeDocRef: string) =>
		makeDsEntry({
			type: ENTRY_TYPE_CHILD,
			docRef: employeeDocRef,
			linkId,
			relationshipModel: RELATIONSHIP_MODEL_NAME,
			sourceRole: PROJECT_ROLE,
			sourceDocRef: SOURCE_DOC_REF_STR,
			targetRole: EMPLOYEE_ROLE,
			targetDocRef: employeeDocRef,
		});

	const makeLinkEntry = (linkId: string, linkDocRef: string) =>
		makeDsEntry({
			type: ENTRY_TYPE_LINK,
			docRef: linkDocRef,
			linkId,
			relationshipModel: RELATIONSHIP_MODEL_NAME,
			sourceRole: PROJECT_ROLE,
			sourceDocRef: SOURCE_DOC_REF_STR,
			targetRole: EMPLOYEE_ROLE,
			targetDocRef: linkDocRef,
		});

	const entries = makeJavaList([makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR), makeChildEntry(LINK_ID_2, EMPLOYEE_B_DOC_REF_STR)]);

	it('converts CHILD entries to RelationshipLinkSpec array', () => {
		const result = dsResultsToLinkSpecs(entries, sourceDocRef);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe(LINK_ID_1);
		expect(result[0].linkDescriptor).toEqual({
			relationshipModelName: RELATIONSHIP_MODEL_NAME,
			sourceRole: PROJECT_ROLE,
			sourceDocRef: sourceDocRef,
			targetRole: EMPLOYEE_ROLE,
			targetDocRef: targetDocRefA,
		});
	});

	it('skips ROOT and LINK type entries as specs, uses LINK node to populate linkDocRef', () => {
		// given
		const mixed = makeJavaList([
			makeDsEntry({ type: ENTRY_TYPE_ROOT, docRef: SOURCE_DOC_REF_STR }),
			makeChildEntry(LINK_ID_1, EMPLOYEE_A_DOC_REF_STR),
			makeLinkEntry(LINK_ID_1, LINK_DOC_REF_STR),
		]);

		// when
		const result = dsResultsToLinkSpecs(mixed, sourceDocRef);

		// then
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(LINK_ID_1);
		expect(result[0].linkDocRef).toEqual(DocumentReference.fromString(LINK_DOC_REF_STR));
	});

	it('sets linkDocRef to undefined when no LINK node exists for the link', () => {
		// given / when
		const result = dsResultsToLinkSpecs(entries, sourceDocRef);

		// then
		expect(result[0].linkDocRef).toBeUndefined();
		expect(result[1].linkDocRef).toBeUndefined();
	});

	it('resolves roles correctly when queried document is in target role', () => {
		// given
		const entry = makeDsEntry({
			type: ENTRY_TYPE_CHILD,
			docRef: ALT_SOURCE_DOC_REF_STR,
			linkId: LINK_ID_3,
			relationshipModel: RELATIONSHIP_MODEL_NAME,
			sourceRole: PROJECT_ROLE,
			sourceDocRef: ALT_SOURCE_DOC_REF_STR,
			targetRole: EMPLOYEE_ROLE,
			targetDocRef: EMPLOYEE_B_DOC_REF_STR,
		});
		const employeeDocRef = DocumentReference.fromString(EMPLOYEE_B_DOC_REF_STR);

		// when
		const result = dsResultsToLinkSpecs(makeJavaList([entry]), employeeDocRef);

		// then — docRef (Employee/B) matches targetDocRef, so it is the target side
		expect(result[0].linkDescriptor.sourceRole).toBe(EMPLOYEE_ROLE);
		expect(result[0].linkDescriptor.targetRole).toBe(PROJECT_ROLE);
		expect(result[0].linkDescriptor.targetDocRef.toString()).toBe(ALT_SOURCE_DOC_REF_STR);
	});

	it('filters by linkedDocRefs', () => {
		const result = dsResultsToLinkSpecs(entries, sourceDocRef, [targetDocRefB]);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(LINK_ID_2);
	});

	it('returns empty array when no matches', () => {
		const noMatch = DocumentReference.fromString('NoMatch/1');
		const result = dsResultsToLinkSpecs(entries, sourceDocRef, [noMatch]);

		expect(result).toHaveLength(0);
	});

	it('handles empty input', () => {
		const result = dsResultsToLinkSpecs(makeJavaList([]), sourceDocRef);

		expect(result).toHaveLength(0);
	});

	describe('skips CHILD entries with missing required fields', () => {
		it('skips entry missing linkId', () => {
			// given
			const entry = makeDsEntry({
				type: ENTRY_TYPE_CHILD,
				docRef: EMPLOYEE_A_DOC_REF_STR,
				relationshipModel: RELATIONSHIP_MODEL_NAME,
				sourceRole: PROJECT_ROLE,
				sourceDocRef: SOURCE_DOC_REF_STR,
				targetRole: EMPLOYEE_ROLE,
				targetDocRef: EMPLOYEE_A_DOC_REF_STR,
			});

			// when
			const result = dsResultsToLinkSpecs(makeJavaList([entry]), sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('skips entry missing relationshipModel', () => {
			// given
			const entry = makeDsEntry({
				type: ENTRY_TYPE_CHILD,
				docRef: EMPLOYEE_A_DOC_REF_STR,
				linkId: LINK_ID_1,
				sourceRole: PROJECT_ROLE,
				sourceDocRef: SOURCE_DOC_REF_STR,
				targetRole: EMPLOYEE_ROLE,
				targetDocRef: EMPLOYEE_A_DOC_REF_STR,
			});

			// when
			const result = dsResultsToLinkSpecs(makeJavaList([entry]), sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('skips entry where both roles are undefined', () => {
			// given
			const entry = makeDsEntry({
				type: ENTRY_TYPE_CHILD,
				docRef: EMPLOYEE_A_DOC_REF_STR,
				linkId: LINK_ID_1,
				relationshipModel: RELATIONSHIP_MODEL_NAME,
				sourceDocRef: SOURCE_DOC_REF_STR,
				targetDocRef: EMPLOYEE_A_DOC_REF_STR,
			});

			// when
			const result = dsResultsToLinkSpecs(makeJavaList([entry]), sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('skips entry missing sourceDocRef', () => {
			// given
			const entry = makeDsEntry({
				type: ENTRY_TYPE_CHILD,
				docRef: EMPLOYEE_A_DOC_REF_STR,
				linkId: LINK_ID_1,
				relationshipModel: RELATIONSHIP_MODEL_NAME,
				sourceRole: PROJECT_ROLE,
				targetRole: EMPLOYEE_ROLE,
				targetDocRef: EMPLOYEE_A_DOC_REF_STR,
			});

			// when
			const result = dsResultsToLinkSpecs(makeJavaList([entry]), sourceDocRef);

			// then
			expect(result).toHaveLength(0);
		});

		it('keeps valid sibling entries when one entry is skipped', () => {
			// given
			const invalid = makeDsEntry({
				type: ENTRY_TYPE_CHILD,
				docRef: EMPLOYEE_A_DOC_REF_STR,
				linkId: undefined,
				relationshipModel: RELATIONSHIP_MODEL_NAME,
				sourceRole: PROJECT_ROLE,
				sourceDocRef: SOURCE_DOC_REF_STR,
				targetRole: EMPLOYEE_ROLE,
				targetDocRef: EMPLOYEE_A_DOC_REF_STR,
			});
			const valid = makeChildEntry(LINK_ID_2, EMPLOYEE_B_DOC_REF_STR);

			// when
			const result = dsResultsToLinkSpecs(makeJavaList([invalid, valid]), sourceDocRef);

			// then
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(LINK_ID_2);
		});
	});
});
