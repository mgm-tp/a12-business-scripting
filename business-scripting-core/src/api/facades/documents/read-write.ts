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

import { DocumentPart, DocumentV2 } from '../../../graaljs-compat-typings/index.js';
import { DocumentReference } from '../../document-reference.js';
import {
    executionContext,
    isDataServicesContext,
    isTestContext,
    isWorkflowContext,
} from '../../execution-contexts.js';
import {
    documentToJson,
    getDocumentPartsFromJson,
    getFieldValues,
    loadDocumentForAppend,
    prepareFieldsForWrite,
    toDocumentPart,
} from '../../../internal/document-utils.js';
import { getDefaultRepetitionsIfEmpty, isDocumentV2 } from '../../../internal/helpers.js';
import { toJavaDocumentPart, toJavaDocumentReference, toJavaLocale } from '../../../internal/java-interop.js';
import { mockDocumentV2FromJson } from '../../../internal/mock-helpers.js';
import { SimpleList } from '../../simple-list.js';
import { mapDsError } from '../../../internal/ds-error-mapper.js';
import { mapRpcError } from '../../../internal/rpc-error-mapper.js';
import { DocumentNotFoundError, InvalidDocumentPartError, UnsupportedContextError } from '../../errors.js';
import { callRpc } from "../../../internal/rpc.js";
import {
    ElementPath,
    FieldPath,
    FieldSpec,
    FieldValue,
} from '../../types.js';
import { getDocumentV2JavaClass } from '../../../internal/java-classes.js';

import * as Batch from '../batch/index.js';
import * as Log from '../logging.js';
import { FailConditionFactory, testFailConditions } from '../utils/utils-or-fail.js';

import { toDocumentV2 } from './serialization.js';
import * as self from './read-write.js';

/**
 * Fetches a single document by reference.
 * @param docRef - The document reference to fetch.
 * @returns A promise resolving to the document, or undefined if not found.
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * const document = await A12.Documents.get(docRef)
 * ```
 */
export function get(docRef: DocumentReference): Promise<DocumentV2 | undefined>;
/**
 * Fetches multiple documents by reference.
 * @param docRefs - The document references to fetch.
 * @returns A promise resolving to a list of documents in the same order as the input references. Not-found documents are undefined.
 *
 * @example
 * ```ts
 * const docRef1 = DocumentReference.fromString("Project_DM/1")
 * const docRef2 = DocumentReference.fromString("Project_DM/2")
 *
 * const documentList = await A12.Documents.get([docRef1, docRef2])
 * ```
 */
export function get(docRefs: DocumentReference[]): Promise<SimpleList<DocumentV2 | undefined>>;
export async function get(
	docRefOrRefs: DocumentReference | DocumentReference[],
): Promise<DocumentV2 | undefined | SimpleList<DocumentV2 | undefined>> {
	const isArray = Array.isArray(docRefOrRefs);
	const refs = isArray ? docRefOrRefs : [docRefOrRefs];

	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: DocumentService.load(DocumentReference)');
		try {
			const docs = refs.map((ref) => {
				// @ts-expect-error - DocService in context
				const optionalResult = executionContext.documentService['load(com.mgmtp.a12.dataservices.document.DocumentReference)'](toJavaDocumentReference(ref));
				return optionalResult.isPresent() ? (optionalResult.get().getKernelDocument() as DocumentV2) : undefined;
			});
			return Promise.resolve(isArray ? new SimpleList(docs) : docs[0]);
		} catch (error) {
			throw mapDsError(error, { operationName: 'Documents.get', docRef: refs.map((r) => r.toString()).join(', ') });
		}
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		if (refs.length === 1) {
			try {
				return Promise.resolve(executionContext.dataServicesRpcFacade.tryGetDocument(refs[0]!.toString()));
			} catch (error) {
				throw mapRpcError(error, { operationName: 'Documents.get', docRef: refs[0]!.toString() });
			}
		}
		const operations = refs.map((ref) => Batch.Documents.get(ref));
		const batchResults = Batch.call(...operations);
		return new SimpleList(operations.map((op) => batchResults.get(op)));
	} else if (isTestContext(executionContext)) {
        // automatic type-narrowing does not work in .map closure
        const testContext = executionContext
        const documents = await Promise.all((refs).map(async docRef => {
            let docResult: Record<string, unknown>;
            try {
                docResult = await callRpc(
                    testContext.serverConnector(),
                    'GET_DOCUMENT',
                    { docRef: docRef.toString() }
                );
            } catch (err) {
                if (isDocumentNotFoundRpcError(err)) { return undefined; }
                throw err;
            }

            const rawDocument = docResult['document'];
            if (!rawDocument) {
                return undefined
            }

            // Create mocked DocumentV2 from real data loaded via RPC
            // mockDocumentV2 is used, because it is a Java type and not accessible in node context
            return mockDocumentV2FromJson(rawDocument as Record<string, unknown>, docRef.documentModelName);
        }))
        return Promise.resolve(Array.isArray(docRefOrRefs) ? new SimpleList(documents) : documents[0]);
	}

	throw new UnsupportedContextError('Documents.get');
}

/**
 * This method tries to load a specified document.
 *
 * An error is thrown if the document cannot be loaded successfully.
 *
 * @param docRef - The document reference to fetch
 * @returns A promise resolving to the document (throws if not found)
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 * const document: DocumentV2 = await A12.Documents.getOrFail(docRef)
 *
 * const missingDocRef = DocumentReference.fromString("Project_DM/404")
 * // Throws: [Document.getOrFail] getOrFail(Project_DM/404) - The provided element must not be undefined!
 * await A12.Documents.getOrFail(missingDocRef)
 * ```
 */
export function getOrFail(docRef: DocumentReference): Promise<DocumentV2>
/**
 * This method tries to load all the documents specified.
 *
 * An error is thrown if the number of documents returned does not match the number of specified references.
 *
 * @param docRefs - The list of document references to fetch
 * @returns A promise of the documents in a SimpleList (throws if one was not found)
 *
 * @example
 * ```ts
 * const documents: SimpleList<DocumentV2> = await A12.Documents.getOrFail([docRef1, docRef2])
 *
 * const wrongDocRefs: DocumentReference[] = [DocumentReference.fromString("Project_DM/1"),DocumentReference.fromString("Project_DM/404")]
 * // Throws: [Document.getOrFail] getOrFail([Project_DM/1,Project_DM/2]) - The provided element must not have an unexpected size! Reason: Expected 2, got 1.
 * await A12.Documents.getOrFail(wrongDocRefs)
 * ```
 */
export function getOrFail(docRefs: DocumentReference[]): Promise<SimpleList<DocumentV2>>
export async function getOrFail(docRefOrRefs: DocumentReference | DocumentReference[]): Promise<DocumentV2 | SimpleList<DocumentV2>> {
	if (Array.isArray(docRefOrRefs)) {
		const documents = await self.get(docRefOrRefs);
		testFailConditions(
			documents,
			[
				FailConditionFactory.Undefined(),
				FailConditionFactory.EmptyList(),
				FailConditionFactory.UnexpectedSize(docRefOrRefs.length),
			],
			(msg) => new DocumentNotFoundError(`[Documents.getOrFail] getOrFail([${docRefOrRefs}]) - ${msg}`),
		);
		return new SimpleList<DocumentV2>(documents.toArray().map((e) => e as DocumentV2));
	}

	const document = await self.get(docRefOrRefs);
	testFailConditions(
		document,
		[FailConditionFactory.Undefined()],
		(msg) => new DocumentNotFoundError(`[Documents.getOrFail] getOrFail(${docRefOrRefs as DocumentReference}) - ${msg}`),
	);
	return document as DocumentV2;
}

/**
 * Modifies a single document from given document data.
 * @param docRef - The document reference.
 * @param document - The document data as a plain JSON object.
 * @param locale - Optional locale for validation error messages. If not provided, DataServices will use its default.
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * A12.Documents.modify(docRef, { Project: { Name: "New Name" } })
 * ```
 */
export function modify(docRef: DocumentReference, document: object, locale?: string): Promise<void>;
/**
 * Modifies multiple documents at once.
 * @param documents - A list of documents to modify, each with a docRef and document data.
 * @param locale - Optional locale for validation error messages. If not provided, DataServices will use its default.
 *
 * @example
 * ```ts
 * const docRef1 = DocumentReference.fromString("Project_DM/1")
 * const docRef2 = DocumentReference.fromString("Project_DM/2")
 *
 * A12.Documents.modify([
 *      { docRef: docRef1, document: modifiedDocument1 },
 *      { docRef: docRef2, document: modifiedDocument2 }
 * ])
 * ```
 */
export function modify(documents: { docRef: DocumentReference; document: object }[], locale?: string): Promise<void>;
export async function modify(
	docRefOrDocuments: DocumentReference | { docRef: DocumentReference; document: object }[],
	documentOrLocale?: object | string,
	locale?: string,
): Promise<void> {
	if (Array.isArray(docRefOrDocuments)) {
		const specs = docRefOrDocuments;
		const batchLocale = documentOrLocale as string | undefined;

		if (isDataServicesContext(executionContext)) {
			for (const spec of specs) {
				modifyUsingDocumentService(spec.docRef, spec.document, batchLocale);
			}
			return;
		} else if (isWorkflowContext(executionContext)) {
			Log.info('Running in engine task context...');
			const operations = specs.map((spec) => Batch.Documents.modify(spec.docRef, spec.document, batchLocale));
			Batch.call(...operations);
			return;
		} else if (isTestContext(executionContext)) {
            // automatic type-narrowing does not work in .map closure
            const testContext = executionContext
			await Promise.all(specs.map((spec) => {
				return callRpc(
                    testContext.serverConnector(),
                    'MODIFY_DOCUMENT',
                    {
                        docRef: spec.docRef.toString(),
                        document: spec.document,
                        locale: batchLocale ?? null,
                    }
                );
			}));
			return;
		}
	} else {
		const docRef = docRefOrDocuments;
		const document = documentOrLocale as object;

		if (isDataServicesContext(executionContext)) {
			modifyUsingDocumentService(docRef, document, locale);
			return;
		} else if (isWorkflowContext(executionContext)) {
			Log.info('Running in engine task context...');
			try {
				const json = documentToJson(document);
				executionContext.dataServicesRpcFacade.tryModifyDocumentFromJson(docRef.toString(), json, toJavaLocale(locale));
			} catch (error) {
				throw mapRpcError(error, {
					operationName: 'Documents.modify',
					docRef: docRef.toString(),
					documentModelName: docRef.documentModelName,
				});
			}
			return;
		} else if (isTestContext(executionContext)) {
            await callRpc(
                executionContext.serverConnector(),
                'MODIFY_DOCUMENT',
                {
                    docRef: docRef.toString(),
                    document,
                    locale: locale ?? null,
                }
            )
			return;
		}
	}

	throw new UnsupportedContextError('Documents.modify');
}

function modifyUsingDocumentService(docRef: DocumentReference, document: object, locale?: string): void {
	Log.info('Calling Java: DocumentService.update(DocumentReference, DocumentV2, Locale)');
	try {
		const rawDoc = isDocumentV2(document) ? document : toDocumentV2(JSON.stringify(document), docRef.documentModelName);
		// DocumentService.update(DocumentReference, DocumentV2, Locale) requires DocumentV2.getDocumentModelId() to be non-null,
		// but deserializeV2 uses the model name only for schema lookup and does not embed it in the returned DocumentV2.
		// Reconstructing via ofRootRootGroup sets the model ID explicitly.
		const doc = getDocumentV2JavaClass().ofRootRootGroup(docRef.documentModelName, rawDoc.toRootRootGroup());
		const javaDocRef = toJavaDocumentReference(docRef);
		// @ts-expect-error - locale can be null/undefined, DataServices will use default
		executionContext.documentService[
			'update(com.mgmtp.a12.dataservices.document.DocumentReference,com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale)'
		](javaDocRef, doc, toJavaLocale(locale) ?? null);
	} catch (error) {
		throw mapDsError(error, { operationName: 'Documents.modify', docRef: docRef.toString(), documentModelName: docRef.documentModelName });
	}
}

/**
 * Reads one or multiple fields from a document.
 * @param docRef - The document reference to read from.
 * @param elements - One or more field paths or group paths to read, optionally with repetitions.
 * @returns A promise resolving to a map of field path to value, a single value if exactly one element was passed and one field was found,
 *          or `undefined` if exactly one element was passed and the field is absent.
 * @throws {DocumentNotFoundError} If the document does not exist.
 *
 * @remarks
 * **Return types:** Values are returned as strings (for date/time types) or their native JS type:
 * - Date: `"2025-01-30"`
 * - DateTime: `"2025-01-30T14:30:00"`
 * - Time: `"14:30:00"`
 * - DateRange: `"2025-01-01/2025-12-31"`
 * - Number/Decimal: `number`
 * - Boolean: `boolean`
 * - String/Enum: `string`
 *
 * **Repeated groups:** When reading a path in a repeatable group, returns a single repetition —
 * the one specified by `repetitions`, or the default. To iterate over all repetitions, read each one explicitly.
 *
 * **Known Limitations:**
 * - **DateFragment fields** are returned as full date strings (e.g., "2025-01" becomes "2025-01-01").
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * // Read a group
 * const readGroup = await A12.Documents.read(docRef, "/Project") as { [p: string]: FieldValue }
 *
 * // Read a field
 * const readField = await A12.Documents.read(docRef, "/Project/Name")
 * const readField = await A12.Documents.read(docRef, "Project", "Name")
 *
 * // Read from repeatable group
 * const readField = await A12.Documents.read(docRef, {element: "/Tasks/Name", repetitions: [2, 1]})
 * ```
 */
export async function read(
    docRef: DocumentReference,
    ...elements: (ElementPath | { element: ElementPath; repetitions?: number[] })[]
): Promise<{ [key: string]: FieldValue; } | FieldValue> {
	if (elements.length === 0) {
		return {};
	}
	const normalizedElements = elements.map((e) =>
		typeof e === 'object' && e != null && 'element' in e
			? (e as { element: ElementPath; repetitions?: number[] })
			: { element: e as ElementPath },
	);
	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: DocumentService.load(DocumentReference)');
		try {
			const optionalResult = executionContext.documentService['load(com.mgmtp.a12.dataservices.document.DocumentReference)'](toJavaDocumentReference(docRef));
			if (!optionalResult.isPresent()) {
				throw new DocumentNotFoundError(`[Documents.read] Document '${docRef.toString()}' not found.`);
			}
			const document = optionalResult.get().getKernelDocument();
			return getFieldValues(document, normalizedElements);
		} catch (error) {
			throw mapDsError(error, { operationName: 'Documents.read', docRef: docRef.toString() });
		}
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		try {
			const document = executionContext.dataServicesRpcFacade.tryGetDocument(docRef.toString());
			if (!document) {
				throw new DocumentNotFoundError(`[Documents.read] Document '${docRef.toString()}' not found.`);
			}
			return getFieldValues(document, normalizedElements);
		} catch (error) {
			throw mapRpcError(error, { operationName: 'Documents.read', docRef: docRef.toString() });
		}
	} else if (isTestContext(executionContext)) {
        const doc = await get(docRef);
        if (!doc) {
            throw new DocumentNotFoundError(`[Documents.read] Document '${docRef.toString()}' not found.`);
        }
        return getFieldValues(doc, normalizedElements);
	}
	throw new UnsupportedContextError('Documents.read');
}

/**
 * Writes one or several fields to a document.
 * @param docRef - The document reference to write to.
 * @param fields - List of field specifications. Accepts either `{ field, value, ... }` format or `FieldSpec`. Use `append: true` to add a new entry to a repeatable group.
 * @param locale - Optional locale. If not provided, DataServices will use its default.
 *
 * @remarks
 * **Value types:** Values should be passed as strings in the format expected by the field type:
 * - Date: `"2025-01-30"`
 * - DateTime: `"2025-01-30T14:30:00"`
 * - Time: `"14:30:00"`
 * - DateFragment: `"2025-01"` (format depends on model)
 * - DateRange: `"2025-01-01/2025-12-31"`
 * - Number/Decimal: `42` or `"42"` (both work)
 * - Boolean: `true` or `"true"` (both work)
 *
 * **Do NOT pass Java objects** (e.g., java.util.Date) - DS internally calls `toString()` which produces incorrect formats.
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * // Modifying one field
 * await A12.Documents.writeFields(docRef, [
 *      { field: "/Project/Name", value: "newValue", repetitions: [1, 1] }
 * ])
 *
 * // Modifying more fields
 * await A12.Documents.writeFields(docRef, [
 *      { field: "/Project/Name", value: "newValue", repetitions: [1, 1] },
 *      { field: "/Project/Employees", value: 20, repetitions: [1, 1] }
 * ])
 *
 * // Appending to a repeatable group
 * await A12.Documents.writeFields(docRef, [
 *      { field: "/Tasks/Name", value: "New Task", append: true }
 * ])
 * ```
 */
export async function writeFields(
    docRef: DocumentReference,
    fields: (
        | { field: FieldPath; value: FieldValue; repetitions?: number[]; append?: boolean }
        | (FieldSpec & { append?: boolean })
        )[],
    locale?: string,
): Promise<void> {
	const document = await loadDocumentForAppend(docRef, fields);
	const normalized = prepareFieldsForWrite(fields, document);
	const documentParts: DocumentPart[] = normalized.map(toDocumentPart);

	await applyDocumentParts(docRef, documentParts, 'Documents.writeFields', locale);
}

/**
 * Writes a JSON object to a document element (group or field).
 * @param docRef - The document reference to write to.
 * @param element - The target element path.
 * @param data - The JSON data to write (as json object or string).
 * @param locale - Optional locale. If not provided, DataServices will use its default.
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * // Writing to a field
 * A12.Documents.writeAsJson(docRef, "/Project/Name", "New Project Name")
 *
 * // Writing to a group
 * A12.Documents.writeAsJson(docRef, "/Tasks", [
 *      {TaskName: "Task1"},
 *      {TaskName: "Task2"}
 * ])
 * ```
 */
export async function writeAsJson(
	docRef: DocumentReference,
	element: ElementPath,
	data: unknown,
	locale?: string,
): Promise<void> {
	const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
	const documentParts = getDocumentPartsFromJson(parsedData, element);
	await applyDocumentParts(docRef, documentParts, "Documents.writeAsJson", locale);
}

/** Applies DocumentParts to a document via the appropriate context (DS, RPC, or TestContext). */
async function applyDocumentParts(
    docRef: DocumentReference,
    documentParts: DocumentPart[],
    operationName: string,
    locale?: string
): Promise<void> {
	if (documentParts.length === 0) {
		return;
	}

	documentParts.forEach((documentPart) => {
		const expectedRepetitionsLength = getDefaultRepetitionsIfEmpty(documentPart.path).length;
		const actualRepetitionsLength = documentPart.repetitions.length;
		if (actualRepetitionsLength != expectedRepetitionsLength) {
			throw new InvalidDocumentPartError(
				'Invalid document part for ' +
					docRef.toString() +
					': Invalid repetitions length for path ' +
					documentPart.path +
					' - expected ' +
					expectedRepetitionsLength +
					' but got ' +
					actualRepetitionsLength
			);
		}
	});

	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: DocumentService.update(DocumentReference, List<DocumentPart>, Locale)');
		try {
			const javaDocumentParts = documentParts.map(toJavaDocumentPart);
			executionContext.documentService['update(com.mgmtp.a12.dataservices.document.DocumentReference,java.util.List,java.util.Locale)'](toJavaDocumentReference(docRef), javaDocumentParts, toJavaLocale(locale) ?? null);
		} catch (error) {
			throw mapDsError(error, {
				operationName,
				docRef: docRef.toString(),
				documentModelName: docRef.documentModelName,
			});
		}
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		try {
			const javaDocumentParts = documentParts.map(toJavaDocumentPart);
			executionContext.dataServicesRpcFacade.tryPartialModifyDocument(docRef.toString(), javaDocumentParts, toJavaLocale(locale));
		} catch (error) {
			throw mapRpcError(error, {
				operationName,
				docRef: docRef.toString(),
				documentModelName: docRef.documentModelName,
			});
		}
	} else if (isTestContext(executionContext)) {
		await callRpc(
            executionContext.serverConnector(),
            'PARTIAL_MODIFY_DOCUMENT',
            {
                docRef: docRef.toString(),
                documentPart: documentParts,
                locale: locale ?? null,
            }
        );
	} else {
		throw new UnsupportedContextError(operationName);
	}
}

/**
 * Detects RPC errors where the document was not found, identified by the A12 error key embedded in the message.
 * `error.document.notFound` is part of the A12 server contract; if it changes, this check must be updated.
 */
function isDocumentNotFoundRpcError(err: unknown): boolean {
    return err instanceof Error && err.message.includes('error.document.notFound');
}
