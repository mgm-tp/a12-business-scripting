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

import { DocumentV2, JavaOptional } from '../../../graaljs-compat-typings/index.js';
import { DocumentReference } from '../../document-reference.js';
import { unwrapOptional } from '../../../internal/java-interop.js';
import {
	loadDocumentForAppend,
	parseDocRefResult,
	prepareFieldsForWrite,
	toDocRefList,
} from '../../../internal/document-utils.js';
import { SimpleList } from '../../simple-list.js';
import { Constraint, DocumentModelName, FieldPath, FieldSpec, FieldValue } from '../../types.js';

import { BatchOperation, RPC_METHODS } from './batch-api.js';

/**
 * Document-related batch operations.
 * Mirrors A12.Documents methods that support batching.
 */

/**
 * Creates a new document and returns its reference.
 * @param documentModelName - The document model to use.
 * @param document - Optional initial document data as a plain JSON object.
 * @param locale - Optional locale for validation. If not provided, DataServices will use its default.
 * @returns The document reference of the newly created document.
 */
export function create(
	documentModelName: DocumentModelName,
	document?: object,
	locale?: string,
): BatchOperation<DocumentReference> {
	return {
		methodName: RPC_METHODS.DOCUMENTS_CREATE,
		params: { documentModelName, document, locale },
		transformResult: parseDocRefResult,
	};
}

/**
 * Copies a document and returns the new document reference.
 * Attachments are copied along with the document.
 * @param docRef - The document reference to copy.
 * @param locale - Optional locale for validation. If not provided, DataServices will use its default.
 * @returns The document reference of the newly created copy.
 */
export function copy(docRef: DocumentReference, locale?: string): BatchOperation<DocumentReference> {
	return {
		methodName: RPC_METHODS.DOCUMENTS_COPY,
		params: { docRef: docRef.toString(), locale },
		transformResult: parseDocRefResult,
	};
}

/**
 * Gets a document by its reference.
 * @param docRef - The document reference to load.
 * @returns The loaded document, or undefined if not found.
 */
export function get(docRef: DocumentReference): BatchOperation<DocumentV2 | undefined> {
	return {
		methodName: RPC_METHODS.DOCUMENTS_GET,
		params: { docRef: docRef.toString() },
		transformResult: (raw: unknown) =>
			unwrapOptional(raw as JavaOptional<DocumentV2> | DocumentV2 | null) ?? undefined,
	};
}

/**
 * Modifies a document completely.
 * @param docRef - The document reference to modify.
 * @param document - The new document data as a plain JSON object.
 * @param locale - Optional locale for validation. If not provided, DataServices will use its default.
 */
export function modify(docRef: DocumentReference, document: object, locale?: string): BatchOperation<void> {
	return {
		methodName: RPC_METHODS.DOCUMENTS_MODIFY,
		params: { docRef: docRef.toString(), document, locale },
	};
}

/**
 * Removes a document by its reference.
 * @param docRef - The document reference to remove.
 * @param locale - Optional locale for validation. If not provided, DataServices will use its default.
 */
export function remove(docRef: DocumentReference, locale?: string): BatchOperation<void> {
	return {
		methodName: RPC_METHODS.DOCUMENTS_REMOVE,
		params: { docRef: docRef.toString(), locale },
	};
}

/**
 * Finds documents by model name and optional constraint.
 * @param documentModelName - The document model to query.
 * @param constraint - Optional constraint for filtering documents.
 * @returns List of document references matching the criteria.
 */
export function find(
	documentModelName: DocumentModelName,
	constraint?: Constraint,
): BatchOperation<SimpleList<DocumentReference>> {
	return {
		methodName: RPC_METHODS.DOCUMENTS_FIND,
		params: { documentModelName, constraint },
		transformResult: (raw: unknown) => new SimpleList(toDocRefList(raw as string[])),
	};
}

/**
 * Writes one or several fields to a document.
 * @param docRef - The document reference to write to.
 * @param fields - Array of field specifications. Accepts either `{ field, value, ... }` format or `FieldSpec` (from e.g. `FieldSpecs.fromJson`). Use `append: true` to add a new entry to a repeatable group.
 * @param locale - Optional locale for validation.
 */
export async function writeFields(
    docRef: DocumentReference,
    fields: (
        | { field: FieldPath; value: FieldValue; repetitions?: number[]; append?: boolean }
        | (FieldSpec & { append?: boolean })
        )[],
    locale?: string,
): Promise<BatchOperation<void>> {
	const document = await loadDocumentForAppend(docRef, fields);
	const normalizedFields = prepareFieldsForWrite(fields, document);

	return {
		methodName: RPC_METHODS.DOCUMENTS_WRITE_FIELDS,
		params: { docRef: docRef.toString(), fields: normalizedFields, locale },
	};
}
