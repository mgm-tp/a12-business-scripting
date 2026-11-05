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

import { v4 as uuidv4 } from 'uuid';

import { DocumentPart, DocumentV2, GroupInstanceV2, RepetitionsV2 } from '../graaljs-compat-typings/index.js';
import { ElementPath, FieldSpec, FieldValue } from '../api/types.js';
import { get as getDocument } from '../api/facades/documents/read-write.js';
import {
    executionContext,
    isDataServicesContext,
    isTestContext,
    isWorkflowContext,
} from '../api/execution-contexts.js';
import { DocumentNotFoundError } from "../api/errors.js";
import { DocumentReference } from '../api/document-reference.js';

import { getDocumentSerializationConfigJavaClass, getStringWriterJavaClass, getUuidJavaClass } from './java-classes.js';
import {
    arraysEqual,
    getDefaultRepetitionsIfEmpty,
    hasPath,
    isDocumentV2,
    repetitionsStartWith,
    WriteFieldInput,
} from './helpers.js';
import { convertJavaFieldValue } from './java-interop.js';

// =============================================================================
// Document Field Access
// =============================================================================

/** Gets field values from a document for given element paths. */
export function getFieldValues(
	document: DocumentV2,
	elements: Array<{ element: ElementPath; repetitions?: number[] }>,
): { [key: string]: FieldValue } | FieldValue {
	const fieldValues: { [key: string]: FieldValue } = {};

	for (const { element, repetitions } of elements) {
		collectFieldValuesForPath(document, element, repetitions, fieldValues);
	}

	if (elements.length === 1) {
		const found = Object.values(fieldValues);
		if (found.length === 0) {return undefined;}
		if (found.length === 1) {return found[0];}
	}
	return fieldValues;
}

/**
 * Gets repetitions for appending a new entry to a repeatable group.
 * Finds the current size of the parent group via directSubgroup navigation and returns [..., size + 1, 1].
 */
export function getAppendRepetitions(document: DocumentV2, fieldPath: string): number[] {
	const pathParts = fieldPath.split('/').filter(Boolean);
	if (pathParts.length < 2) {
		return [1];
	}

	const groupPathParts = pathParts.slice(0, -1);
	const groupDepth = groupPathParts.length;
	const maxGroupRep = findMaxGroupRepetition(document, groupPathParts, 0);

	// Build repetitions: [1, 1, ..., maxGroupRep + 1, 1]
	const result = Array(pathParts.length).fill(1) as number[];
	result[groupDepth - 1] = maxGroupRep + 1;
	return result;
}

/**
 * Like getAppendRepetitions, but maintains a virtual counter across multiple calls in one
 * prepareFieldsForWrite pass. All append:true entries targeting the same group increment the same
 * virtual counter. Counter is keyed by group path (parent of the last path segment),
 * seeded from the document's current max on first encounter, incremented on every subsequent call.
 */
function getAppendRepetitionsVirtual(
	document: DocumentV2,
	fieldPath: string,
	virtualGroupReps: Map<string, number>,
): number[] {
	const pathParts = fieldPath.split('/').filter(Boolean);
	if (pathParts.length < 2) {
		return [1];
	}

	const groupPath = '/' + pathParts.slice(0, -1).join('/');
	const groupDepth = pathParts.length - 1;

	let nextGroupRep: number;
	if (virtualGroupReps.has(groupPath)) {
		nextGroupRep = virtualGroupReps.get(groupPath)! + 1;
	} else {
		const seedReps = getAppendRepetitions(document, fieldPath);
		nextGroupRep = seedReps[groupDepth - 1]!;
	}
	virtualGroupReps.set(groupPath, nextGroupRep);

	const result = Array(pathParts.length).fill(1) as number[];
	result[groupDepth - 1] = nextGroupRep;
	return result;
}

// =============================================================================
// Field Normalization for Write
// =============================================================================

/**
 * Converts writeFields input to FieldSpec[], handling append.
 * Each append:true entry creates a distinct new group instance with its own sequential repetition index.
 * @param fields - Array of FieldInput or FieldSpec (with optional append).
 * @param document - Document needed for append (to calculate next repetition).
 */
export function prepareFieldsForWrite(fields: WriteFieldInput[], document?: DocumentV2): FieldSpec[] {
	const result: FieldSpec[] = [];
	const virtualGroupReps = new Map<string, number>();
	for (const f of fields) {
		if (hasPath(f)) {
			// FieldSpec format: { path, value, repetitions?, append? }
			const { path, value, repetitions, append } = f;
			if (append && document) {
				result.push({ path, value, repetitions: getAppendRepetitionsVirtual(document, path, virtualGroupReps) });
			} else {
				result.push(repetitions === undefined ? { path, value } : { path, value, repetitions });
			}
		} else {
			// FieldInput format: { field, value, repetitions?, append? }
			const { field, value, repetitions, append } = f;
			if (append && document) {
				result.push({
					path: field,
					value,
					repetitions: getAppendRepetitionsVirtual(document, field, virtualGroupReps),
				});
			} else {
				result.push(repetitions === undefined ? { path: field, value } : { path: field, value, repetitions });
			}
		}
	}
	return result;
}

/**
 * Checks if any field in the input array needs append (requires document load).
 */
export function needsAppend(fields: WriteFieldInput[]): boolean {
	return fields.some((f) => f.append);
}

/**
 * Loads document if append is needed, throws if document not found.
 * @param docRef - The document reference.
 * @param fields - The fields to check for append.
 */
export async function loadDocumentForAppend(docRef: DocumentReference, fields: WriteFieldInput[]): Promise<DocumentV2 | undefined> {
	if (!needsAppend(fields)) {
		return undefined;
	}
	const document = await getDocument(docRef) as DocumentV2 | undefined;
	if (!document) {
		throw new DocumentNotFoundError(`Document not found for append: ${docRef.toString()}`);
	}
	return document;
}

// =============================================================================
// Document Reference Helpers
// =============================================================================

/** Parses a DocRef from RPC result format { docRef: string }. */
export function parseDocRefResult(raw: unknown): DocumentReference {
	const result = raw as { docRef: string };
	return DocumentReference.fromString(result.docRef);
}

/** Converts an array of docRef strings to a list of DocumentReferences. */
export function toDocRefList(docRefStrings: string[]): DocumentReference[] {
	return docRefStrings.map((refStr) => DocumentReference.fromString(refStr));
}

// =============================================================================
// DocumentV2 Serialization (internal)
// =============================================================================

/** Converts a DocumentV2 to a JSON string. */
export function fromDocumentV2(document: DocumentV2): string {
	if (isWorkflowContext(executionContext)) {
		return executionContext.dataServicesRpcFacade.documentV2ToJson(document);
	} else if (isDataServicesContext(executionContext)) {
		const StringWriter = getStringWriterJavaClass();
		const SerializationConfig = getDocumentSerializationConfigJavaClass();
		const writer = new StringWriter();
		const config = SerializationConfig.builder().format(SerializationConfig.Format.JSON).build();
		executionContext.documentV2Serializer[
			'serializeV2(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.io.Writer,com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig)'
		](document, writer, config);
		return writer.toString();
	} else {
		throw new Error('[fromDocumentV2] Unsupported execution context.');
	}
}

/** Converts a DocumentV2 or plain JSON object to a JSON string. */
export function documentToJson(document: DocumentV2 | object): string {
	return isDocumentV2(document) ? fromDocumentV2(document) : JSON.stringify(document);
}

// =============================================================================
// UUID (internal)
// =============================================================================

/** Creates a random UUID string. */
export function createUuid(): string {
	if (isTestContext(executionContext)) {
		return uuidv4();
	} else {
		return getUuidJavaClass().randomUUID().toString();
	}
}

// =============================================================================
// Document Parts
// =============================================================================

/** Converts a FieldSpec to a DocumentPart. */
export function toDocumentPart(fieldSpec: FieldSpec): DocumentPart {
	return {
		path: fieldSpec.path,
		value: fieldSpec.value,
		repetitions: fieldSpec.repetitions ?? getDefaultRepetitionsIfEmpty(fieldSpec.path),
	};
}

/**
 * Converts JSON directly to DocumentParts with a base path prefix.
 * More efficient than JSON → FieldSpec → DocumentParts.
 */
export function getDocumentPartsFromJson(json: unknown, basePath: string): DocumentPart[] {
	const basePathDepth = basePath.split('/').filter(Boolean).length;
	// If root is array, it represents repetitions of the last basePath element
	// so we exclude that level from baseReps (array index will provide it)
	const isRootArray = Array.isArray(json);
	const baseReps = isRootArray ? Array(basePathDepth - 1).fill(1) : Array(basePathDepth).fill(1);

	return traverseJsonLeaves(json, (path, value, reps) => ({
		path: basePath + path,
		value,
		repetitions: [...baseReps, ...reps],
	}));
}

// =============================================================================
// JSON Traversal
// =============================================================================

/**
 * Traverses a JSON structure and calls onLeaf for each leaf value.
 * Handles arrays (with 1-based repetition indices) and nested objects.
 */
export function traverseJsonLeaves<T>(
	json: unknown,
	onLeaf: (path: string, value: unknown, repetitions: number[]) => T,
	currentPath: string = '',
	repetitions: number[] = [],
	result: T[] = [],
): T[] {
	if (Array.isArray(json)) {
		for (let i = 0; i < json.length; i++) {
			traverseJsonLeaves(json[i], onLeaf, currentPath, [...repetitions, i + 1], result);
		}
	} else if (typeof json === 'object' && json !== null) {
		const jsonObject = json as Record<string, unknown>;
		for (const key of Object.keys(jsonObject)) {
			const newPath = currentPath ? `${currentPath}/${key}` : `/${key}`;
			const childValue = jsonObject[key];
			const isArray = Array.isArray(childValue);
			traverseJsonLeaves(childValue, onLeaf, newPath, isArray ? repetitions : [...repetitions, 1], result);
		}
	} else {
		result.push(onLeaf(currentPath, json, repetitions));
	}
	return result;
}

// =============================================================================
// Internal Helpers - DocumentV2 Field Traversal
// =============================================================================

/** Collects field values for a single path element into result map */
function collectFieldValuesForPath(
	document: DocumentV2,
	path: string,
	repetitions: number[] | undefined,
	result: { [key: string]: FieldValue },
): void {
	const reps = getDefaultRepetitionsIfEmpty(path, repetitions);
	forEachFieldInGroup(document, '', [], (p, value, fieldReps) => {
		if (!(p === path || p.startsWith(path))) {return;}
		if (!(arraysEqual(fieldReps, reps) || repetitionsStartWith(fieldReps, reps))) {return;}
		result[p] = convertJavaFieldValue(value) as FieldValue;
	});
}

/**
 * Navigates a DocumentV2 group tree to find the highest repetition index of the deepest group
 * segment in pathParts, taken as the max across all repetitions of ancestor groups.
 * Uses directSubgroup() so empty group repetitions (no fields) count toward the result.
 * Sparse repetition indices (null slots between 1 and size()) are skipped safely.
 */
function findMaxGroupRepetition(group: GroupInstanceV2, pathParts: string[], depth: number): number {
	if (depth >= pathParts.length) {
		return 0;
	}
	const repetitions: RepetitionsV2 = group.directSubgroup(pathParts[depth]!);
	const size = repetitions.size();
	if (depth === pathParts.length - 1) {
		return size;
	}
	// Recurse through all repetitions of intermediate groups to find the deepest max
	let maxRep = 0;
	for (let i = 1; i <= size; i++) {
		const sub = repetitions.get(i);
		if (sub) {
			maxRep = Math.max(maxRep, findMaxGroupRepetition(sub, pathParts, depth + 1));
		}
	}
	return maxRep;
}

/**
 * Recursively iterates all field instances in a DocumentV2 group tree.
 * Calls handler for each field with its full path and repetitions array.
 * Uses Java iterator pattern (iterator()/hasNext()/next()) for GraalJS interop.
 */
function forEachFieldInGroup(
	group: GroupInstanceV2,
	pathPrefix: string,
	repsPrefix: number[],
	handler: (path: string, value: unknown, repetitions: number[]) => void,
): void {
	const fieldIter = group.directFields().iterator();
	while (fieldIter.hasNext()) {
		const entry = fieldIter.next();
		const name: string = entry.getKey();
		const field = entry.getValue();
		handler(`${pathPrefix}/${name}`, field.value(), [...repsPrefix, 1]);
	}
	const subIter = group.directSubgroups().iterator();
	while (subIter.hasNext()) {
		const entry = subIter.next();
		const name: string = entry.getKey();
		const repetitions = entry.getValue();
		for (let i = 1; i <= repetitions.size(); i++) {
			const sub = repetitions.get(i);
			if (sub) {
				forEachFieldInGroup(sub, `${pathPrefix}/${name}`, [...repsPrefix, i], handler);
			}
		}
	}
}
