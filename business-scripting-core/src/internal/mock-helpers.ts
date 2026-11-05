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

import {
	DocumentV2,
	FieldInstanceV2,
	GroupInstanceV2,
	JavaOptional,
	JavaSet,
	RepetitionsV2,
} from '../graaljs-compat-typings/index.js';
import { FieldSpec, RelationshipLinkSpec } from '../api/types.js';
import { DocumentReference } from '../api/document-reference.js';

import { getDocumentPartsFromJson } from './document-utils.js';

// =============================================================================
// Java Type Mocks
// =============================================================================

/** Creates a mock JavaOptional for test/dev context */
export function mockJavaOptional<T>(value: T | null | undefined): JavaOptional<T> {
	const hasValue = value !== null && value !== undefined;
	return {
		isPresent: () => hasValue,
		isEmpty: () => !hasValue,
		get: () => {
			if (!hasValue) {
				throw new Error('No value present');
			}
			return value as T;
		},
		orElse: (other: T) => (hasValue ? (value as T) : other),
		orElseGet: (supplier: () => T) => (hasValue ? (value as T) : supplier()),
	};
}

/** Creates a mock Java exception as seen through GraalVM interop, for test/dev context */
export function mockJavaThrowable(fullClassName: string, message: string) {
	return {
		message,
		getClass: () => ({ getName: () => fullClassName }),
		getMessage: () => message,
		getLocalizedMessage: () => message,
		getCause: () => null,
	};
}

/** Creates a mock JavaSet for test/dev context */
export function mockJavaSet<T>(items: T[]): JavaSet<T> {
	const set = new Set(items);
	return {
		size: () => set.size,
		isEmpty: () => set.size === 0,
		contains: (element: T) => set.has(element),
		iterator: () => {
			const iter = set.values();
			return {
				hasNext: () => false, // Simplified - use [Symbol.iterator] for iteration
				next: () => iter.next().value as T,
			};
		},
		toArray: () => [...set],
		add: (element: T) => {
			set.add(element);
			return true;
		},
		remove: (element: T) => set.delete(element),
		clear: () => set.clear(),
		[Symbol.iterator]: () => set.values(),
	};
}

// =============================================================================
// Document Mocks — internal tree types
// =============================================================================

/** Flat descriptor for a field entry in a mock document */
export interface MockFieldEntry {
	readonly path: string;
	readonly value: unknown;
	readonly repetitions: number[];
}

/** Flat descriptor for a group entry in a mock document */
export interface MockGroupEntry {
	readonly path: string;
	readonly repetitions: number[];
}

export type MockDocumentEntry = MockFieldEntry | MockGroupEntry;

interface TreeNode {
	fields: Map<string, unknown>;
	subgroups: Map<string, Map<number, TreeNode>>;
}

function emptyNode(): TreeNode {
	return { fields: new Map(), subgroups: new Map() };
}

function getOrCreateNode(parent: TreeNode, groupName: string, rep: number): TreeNode {
	if (!parent.subgroups.has(groupName)) {
		parent.subgroups.set(groupName, new Map());
	}
	const repMap = parent.subgroups.get(groupName)!;
	if (!repMap.has(rep)) {
		repMap.set(rep, emptyNode());
	}
	return repMap.get(rep)!;
}

function buildTree(entries: MockDocumentEntry[]): TreeNode {
	const root = emptyNode();
	for (const entry of entries) {
		const parts = entry.path.split('/').filter(Boolean);
		const isField = 'value' in entry;
		const requiredRepetitions = isField ? parts.length - 1 : parts.length;
		if (entry.repetitions.length < requiredRepetitions) {
			throw new Error(
				`mockDocumentV2: "${entry.path}" needs ${requiredRepetitions} repetition(s), got ${entry.repetitions.length}`,
			);
		}
		if (isField) {
			let node = root;
			for (let i = 0; i < parts.length - 1; i++) {
				node = getOrCreateNode(node, parts[i]!, entry.repetitions[i]!);
			}
			node.fields.set(parts[parts.length - 1]!, (entry as MockFieldEntry).value);
		} else {
			let node = root;
			for (let i = 0; i < parts.length; i++) {
				node = getOrCreateNode(node, parts[i]!, entry.repetitions[i]!);
			}
		}
	}
	return root;
}

function makeRepetitionsV2(repMap: Map<number, TreeNode>): RepetitionsV2 {
	const maxRep = repMap.size > 0 ? Math.max(...repMap.keys()) : 0;
	return {
		size: () => maxRep,
		get: (i: number) => {
			const node = repMap.get(i);
			return node ? treeNodeToGroupV2(node) : (null as unknown as GroupInstanceV2);
		},
	} as unknown as RepetitionsV2;
}

function treeNodeToGroupV2(node: TreeNode): GroupInstanceV2 {
	const fieldEntries = [...node.fields.entries()].map(([name, value]) => ({
		getKey: () => name,
		// Java value() returns null for absent values; normalize JS undefined to null
		getValue: (): FieldInstanceV2 => ({ value: () => value ?? null } as unknown as FieldInstanceV2),
	}));

	const subgroupEntries = [...node.subgroups.entries()].map(([name, repMap]) => ({
		getKey: () => name,
		getValue: () => makeRepetitionsV2(repMap),
	}));

	return {
		directFields: () => ({
			iterator: () => {
				let i = 0;
				return { hasNext: () => i < fieldEntries.length, next: () => fieldEntries[i++] };
			},
		}),
		directSubgroups: () => ({
			iterator: () => {
				let i = 0;
				return { hasNext: () => i < subgroupEntries.length, next: () => subgroupEntries[i++] };
			},
		}),
		directSubgroup: (name: string) => {
			const repMap = node.subgroups.get(name) ?? new Map<number, TreeNode>();
			return makeRepetitionsV2(repMap);
		},
		directField: (name: string) =>
			node.fields.has(name)
				? ({ value: () => node.fields.get(name) } as unknown as FieldInstanceV2)
				: (null as unknown as FieldInstanceV2),
	} as unknown as GroupInstanceV2;
}

// =============================================================================
// Public mock factory functions
// =============================================================================

/** Creates a mock FieldSpec for test/dev context */
export function mockFieldSpec(path: string, value: unknown, repetitions: number[]): FieldSpec {
	return { path, value, repetitions };
}

/** Creates a mock field entry for use in mockDocumentV2 */
export function mockFieldInstanceV2(path: string, value: unknown, repetitions: number[]): MockFieldEntry {
	return { path, value, repetitions };
}

/** Creates a mock group entry for use in mockDocumentV2 */
export function mockGroupInstanceV2(path: string, repetitions: number[]): MockGroupEntry {
	return { path, repetitions };
}

/**
 * Builds a mock DocumentV2 from a parsed JSON object.
 * Attaches a `toJSON` method so that `JSON.stringify` (used in callRpc) serializes the
 * correct document structure when the mock is passed back to an API that sends it via RPC.
 */
export function mockDocumentV2FromJson(json: Record<string, unknown>, documentModelName: string): DocumentV2 {
	const parts = getDocumentPartsFromJson(json, '');
	const mock = mockDocumentV2(parts.map((p) => mockFieldInstanceV2(p.path, p.value, p.repetitions)), documentModelName);
	(mock as unknown as Record<string, unknown>).toJSON = () => json;
	return mock as unknown as DocumentV2;
}

/** Creates a mock DocumentV2 from a flat list of field and group entries */
export function mockDocumentV2(entries: MockDocumentEntry[], documentModelId: string = ''): DocumentV2 {
	const tree = buildTree(entries);
	const group = treeNodeToGroupV2(tree);
	return {
		...group,
		getId: () => null,
		getDocumentModelId: () => documentModelId,
		empty: () => null,
		ofRootRootGroup: () => null,
		withId: () => null,
		toRootRootGroup: () => null,
		equals: () => false,
		hashCode: () => 0,
	} as unknown as DocumentV2;
}

// =============================================================================
// Link Mocks
// =============================================================================

/** Creates a mock RelationshipLinkSpec for test/dev context */
export function mockLinkSpec(): RelationshipLinkSpec {
	return {
		id: 'mock-link-id',
		linkDescriptor: {
			relationshipModelName: 'MockRM',
			sourceRole: 'source',
			sourceDocRef: DocumentReference.fromString('MockDM/mock-source-id'),
			targetRole: 'target',
			targetDocRef: DocumentReference.fromString('MockDM/mock-target-id'),
		},
	};
}
