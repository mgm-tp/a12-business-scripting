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

import { DocumentTreeResult, DocumentV2, JavaConstraint, } from '../../../graaljs-compat-typings/index.js';
import { DocumentReference } from '../../document-reference.js';
import {
    DataServicesContext,
    executionContext,
    isDataServicesContext,
    isTestContext,
    isWorkflowContext,
} from '../../execution-contexts.js';
import { SimpleList } from '../../simple-list.js';
import { parseDocRefResult, toDocRefList } from '../../../internal/document-utils.js';
import { isDocumentV2 } from '../../../internal/helpers.js';
import { toJavaLocale } from '../../../internal/java-interop.js';
import { mapDsError } from '../../../internal/ds-error-mapper.js';
import { toJavaDocumentReference } from '../../../internal/java-interop.js';
import { mapRpcError } from '../../../internal/rpc-error-mapper.js';
import { DocumentNotFoundError, UnsupportedContextError } from '../../errors.js';
import { callRpc } from "../../../internal/rpc.js";
import { FIRST_PAGE, PAGE_SIZE_LIMIT } from "../../../internal/constants.js";
import { Constraint, DocumentModelName } from '../../types.js';
import {
    getAndOperatorJavaClass,
    getDateRangeOperatorJavaClass,
    getDocumentDeserializationConfigJavaClass,
    getDoubleRangeOperatorJavaClass,
    getExactMatchOperatorJavaClass,
    getNotOperatorJavaClass,
    getOrOperatorJavaClass,
    getPagingJavaClass,
    getQueryRootJavaClass,
    getSimpleSearchOperatorJavaClass,
    getStringReaderJavaClass,
} from '../../../internal/java-classes.js';

import * as Log from '../logging.js';
import * as Batch from '../batch/index.js';

import { toDocumentV2 } from './serialization.js';

/**
 * Creates a single document using a document model name.
 * @param documentModelName - The name of the document model to use for creation.
 * @param document - Optional initial document data as a plain JSON object.
 * @param locale - Optional locale for validation error messages. If not provided, DataServices will use its default.
 * @returns A promise resolving to the document reference of the newly created document.
 *
 * @example
 * ```ts
 * // Create new document without initial document data
 * const docRef = await A12.Documents.create("Project_DM")
 *
 * // Create new document with initial document data
 * const docRef = await A12.Documents.create("Project_DM", { Project: { Name: "A12 Business Scripting" } })
 * ```
 */
export function create(
	documentModelName: DocumentModelName,
	document?: object,
	locale?: string,
): Promise<DocumentReference>;
/**
 * Creates multiple documents at once.
 * @param documents - A list of documents to create, each with a documentModelName and optional initial document data.
 * @param locale - Optional locale for validation error messages. If not provided, DataServices will use its default.
 * @returns A promise resolving to a list of document references for the newly created documents.
 *
 * @example
 * ```ts
 * // Create new documents without initial document data
 * const docRefList = await A12.Documents.create([
 *     { documentModelName: "Project_DM" },
 *     { documentModelName: "Task_DM" }
 * ])
 *
 * // Create new documents with initial document data
 * const docRefList = await A12.Documents.create([
 *      { documentModelName: "Project_DM", document: { Project: { Name: "A12 Business Scripting" } } },
 *      { documentModelName: "Task_DM", document: { Task: { Name: "Task Name" } } },
 * ])
 * ```
 */
export function create(
	documents: { documentModelName: DocumentModelName; document?: object }[],
	locale?: string,
): Promise<SimpleList<DocumentReference>>;
export async function create(
	documentModelNameOrDocuments:
		| DocumentModelName
		| { documentModelName: DocumentModelName; document?: object }[],
	documentOrLocale?: object | string,
	locale?: string,
): Promise<DocumentReference | SimpleList<DocumentReference>> {
	if (Array.isArray(documentModelNameOrDocuments)) {
		const specs = documentModelNameOrDocuments;
		const batchLocale = documentOrLocale as string | undefined;

		if (isDataServicesContext(executionContext)) {
			const refs = specs.map((spec) => createUsingDocumentService(spec.documentModelName, spec.document, batchLocale));
			return new SimpleList(refs);
		} else if (isWorkflowContext(executionContext)) {
			Log.info('Running in engine task context...');
			const operations = specs.map((spec) =>
				Batch.Documents.create(spec.documentModelName, spec.document, batchLocale),
			);
			const results = Batch.call(...operations);
			return new SimpleList(operations.map((op) => results.get(op)));
		} else if (isTestContext(executionContext)) {
            const serverConnector = executionContext.serverConnector();
			const refs = await Promise.all(
				specs.map(async (spec) => {
					const params: Record<string, unknown> = { documentModelName: spec.documentModelName, document: spec.document ?? {} };
					return parseDocRefResult(await callRpc(serverConnector, 'ADD_DOCUMENT', params));
				}),
			);
			return new SimpleList(refs);
		}
	} else {
		const documentModelName = documentModelNameOrDocuments;
		const document = documentOrLocale as object | undefined;

		if (isDataServicesContext(executionContext)) {
			return createUsingDocumentService(documentModelName, document, locale);
		} else if (isWorkflowContext(executionContext)) {
			Log.info('Running in engine task context...');
			try {
				return executionContext.dataServicesRpcFacade.tryAddDocument(documentModelName, document, toJavaLocale(locale));
			} catch (error) {
				throw mapRpcError(error, { operationName: 'Documents.create', documentModelName });
			}
		} else if (isTestContext(executionContext)) {
			const params: Record<string, unknown> = { documentModelName, document: document ?? {} };
			return parseDocRefResult(await callRpc(executionContext.serverConnector(), 'ADD_DOCUMENT', params));
		}
	}

	throw new UnsupportedContextError('Documents.create');
}

/**
 * Fetches documents by model name and optional constraints.
 * @param documentModelName - The name of the document model to query (note that subtypes will not be considered).
 * @param constraint - Optional constraint for filtering documents. Use Documents.Filter to create constraints.
 * @returns A promise resolving to a list of document references matching the criteria.
 *
 * @example
 * ```ts
 * const foundDocuments = await A12.Documents.find(
 *     "Project_DM",
 *     A12.Documents.Filter.field("/Project/Name").equals("A12 Business Scripting")
 * )
 *
 * // With multiple filters combined using AND
 * const foundDocuments = await A12.Documents.find(
 *     "Project_DM",
 *     A12.Documents.Filter.and(
 *         A12.Documents.Filter.field("/Project/Name").equals("A12 Business Scripting"),
 *         A12.Documents.Filter.field("/Project/Status").equals("Active"),
 *     )
 * )
 * ```
 */
export async function find(documentModelName: DocumentModelName, constraint?: Constraint): Promise<SimpleList<DocumentReference>> {
	if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		try {
			const docRefStrings: string[] = executionContext.dataServicesRpcFacade.tryListDocuments(documentModelName, constraint);
			return new SimpleList(toDocRefList(docRefStrings));
		} catch (error) {
			throw mapRpcError(error, { operationName: 'Documents.find', documentModelName });
		}
	} else if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: QueryService.query(QueryRoot, locale)');
		try {
			let queryRootBuilder = getQueryRootJavaClass().builder()
				.targetDocumentModel(documentModelName)
				.projectionName('document')
				.paging(getPagingJavaClass().builder().pageNumber(FIRST_PAGE).pageSize(PAGE_SIZE_LIMIT).build());

			if (constraint) {
				queryRootBuilder = queryRootBuilder.constraint(buildJavaConstraint(constraint));
			}

			const queryPage = executionContext.queryService.query(queryRootBuilder.build(), null);
			const content = queryPage.getContent();

			const docRefs: DocumentReference[] = [];
			for (let i = 0; i < content.size(); i++) {
				const doc = content.get(i) as DocumentTreeResult;
				docRefs.push(DocumentReference.fromString(doc.getDocRef().toString()));
			}
			return new SimpleList(docRefs);
		} catch (error) {
			throw mapDsError(error, { operationName: 'Documents.find', documentModelName });
		}
	} else if (isTestContext(executionContext)) {
        const query: Record<string, unknown> = {
            targetDocumentModel: documentModelName,
            projectionName: 'document',
            paging: { pageSize: PAGE_SIZE_LIMIT, pageNumber: FIRST_PAGE },
        };
        if (constraint) {
            query.constraint = toPlainConstraint(constraint);
        }
        const params: Record<string, unknown> = { query };
        const results = await callRpc(executionContext.serverConnector(), 'QUERY', params) as Record<string, unknown>;
        return new SimpleList(Object.values(results['entries'] ?? []).map(result => parseDocRefResult(result)))
	} else {
		throw new UnsupportedContextError('Documents.find');
	}
}

function toPlainConstraint(constraint: Constraint): Record<string, unknown> {
	switch (constraint.operator) {
		case 'exact_match':
			return { operator: 'exact_match', field: constraint.field, value: constraint.value };
		case 'numeric_range': {
			// The QUERY RPC endpoint's operator name is 'double_range', unlike the 'numeric_range' Constraint discriminator.
			const result: Record<string, unknown> = { operator: 'double_range', field: constraint.field };
			if (constraint.from !== undefined) {result.from = constraint.from;}
			if (constraint.to !== undefined) {result.to = constraint.to;}
			return result;
		}
        case 'date_range': {
            const result: Record<string, unknown> = { operator: 'date_range', field: constraint.field };
            if (constraint.from !== undefined) {result.from = constraint.from;}
            if (constraint.to !== undefined) {result.to = constraint.to;}
            return result;
        }
		case 'simple_search': {
			const result: Record<string, unknown> = { operator: 'simple_search', value: constraint.value };
			if (constraint.fields) {result.fields = constraint.fields;}
			return result;
		}
		case 'and':
			return { operator: 'and', operands: constraint.operands.map(toPlainConstraint) };
		case 'or':
			return { operator: 'or', operands: constraint.operands.map(toPlainConstraint) };
		case 'not':
			return { operator: 'not', operand: toPlainConstraint(constraint.operand) };
	}
}

function buildJavaConstraint(constraint: Constraint): JavaConstraint {
	switch (constraint.operator) {
		case 'exact_match': {
			return getExactMatchOperatorJavaClass().builder().field(constraint.field).value(constraint.value).build();
		}
		case 'numeric_range': {
			let builder = getDoubleRangeOperatorJavaClass().builder().field(constraint.field);
			if (constraint.from !== undefined) { builder = builder.from(constraint.from); }
			if (constraint.to !== undefined) { builder = builder.to(constraint.to); }
			return builder.build();
		}
        case 'date_range': {
            let builder = getDateRangeOperatorJavaClass().builder().field(constraint.field);
            if (constraint.from !== undefined) { builder = builder.from(constraint.from); }
            if (constraint.to !== undefined) { builder = builder.to(constraint.to); }
            return builder.build();
        }
		case 'simple_search': {
			let builder = getSimpleSearchOperatorJavaClass().builder().value(constraint.value);
			if (constraint.fields) { builder = builder.fields(constraint.fields); }
			return builder.build();
		}
		case 'and': {
			return getAndOperatorJavaClass().builder().operands(constraint.operands.map(buildJavaConstraint)).build();
		}
		case 'or': {
			return getOrOperatorJavaClass().builder().operands(constraint.operands.map(buildJavaConstraint)).build();
		}
		case 'not': {
			return getNotOperatorJavaClass().builder().operand(buildJavaConstraint(constraint.operand)).build();
		}
	}
}

/**
 * Copies a document and returns the new document reference.
 * Attachments are only copied inside engine task context.
 * @param docRef - The document reference to copy.
 * @param locale - Optional locale. If not provided, DataServices will use its default.
 * @returns A promise resolving to the document reference of the copy.
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * const newDocRef = await A12.Documents.copy(docRef)
 * ```
 */
export async function copy(docRef: DocumentReference, locale?: string): Promise<DocumentReference> {
	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: DocumentService.load(DocumentReference), DocumentService.create(DocumentV2, Locale)');
		try {
			const javaDocRef = toJavaDocumentReference(docRef);
			const optionalResult = executionContext.documentService['load(com.mgmtp.a12.dataservices.document.DocumentReference)'](javaDocRef);
			if (!optionalResult.isPresent()) {
				throw new DocumentNotFoundError(`Document '${docRef.toString()}' not found.`);
			}
			const sourceDoc = optionalResult.get().getKernelDocument();

			const newDsDoc = executionContext.documentService[
				'create(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale)'
			](sourceDoc, toJavaLocale(locale) ?? null);

			return DocumentReference.fromString(newDsDoc.getMetadata().getDocRef().toString());
		} catch (error) {
			throw mapDsError(error, { operationName: 'Documents.copy', docRef: docRef.toString() });
		}
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		try {
			const newDocRef: string = executionContext.dataServicesRpcFacade.tryCopyDocument(docRef.toString(), toJavaLocale(locale));
			return DocumentReference.fromString(newDocRef);
		} catch (error) {
			throw mapRpcError(error, { operationName: 'Documents.copy', docRef: docRef.toString() });
		}
	} else if (isTestContext(executionContext)) {
		const params: Record<string, unknown> = { docRef: docRef.toString() };
		if (locale !== undefined) { params.locale = locale; }
		return parseDocRefResult(await callRpc(executionContext.serverConnector(), 'COPY_DOCUMENT', params));
	}
	throw new UnsupportedContextError('Documents.copy');
}

/**
 * Deletes a single document.
 * @param docRef - The document reference to delete.
 * @param locale - Optional locale for validation error messages. If not provided, DataServices will use its default.
 *
 * @example
 * ```ts
 * const docRef = DocumentReference.fromString("Project_DM/1")
 *
 * await A12.Documents.remove(docRef)
 * ```
 */
export function remove(docRef: DocumentReference, locale?: string): Promise<void>;
/**
 * Deletes multiple documents.
 * @param docRefs - The document references to delete.
 * @param locale - Optional locale for validation error messages. If not provided, DataServices will use its default.
 *
 * @example
 * ```ts
 * const docRef1 = DocumentReference.fromString("Project_DM/1")
 * const docRef2 = DocumentReference.fromString("Project_DM/2")
 *
 * await A12.Documents.remove([docRef1, docRef2])
 * ```
 */
export function remove(docRefs: DocumentReference[], locale?: string): Promise<void>;
export async function remove(docRefOrRefs: DocumentReference | DocumentReference[], locale?: string): Promise<void> {
	const refs = Array.isArray(docRefOrRefs) ? docRefOrRefs : [docRefOrRefs];

	if (refs.length === 0) {
		return;
	}

	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: DocumentService.deleteAll(Collection)');
		try {
			executionContext.documentService['deleteAll(java.util.Collection)'](refs.map(toJavaDocumentReference));
		} catch (error) {
			throw mapDsError(error, { operationName: 'Documents.remove', docRef: refs.map((r) => r.toString()).join(', ') });
		}
		return;
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		if (refs.length === 1) {
			try {
				executionContext.dataServicesRpcFacade.tryDeleteDocument(refs[0]!.toString(), toJavaLocale(locale));
			} catch (error) {
				throw mapRpcError(error, { operationName: 'Documents.remove', docRef: refs[0]!.toString() });
			}
		} else {
			const operations = refs.map((ref) => Batch.Documents.remove(ref, locale));
			Batch.call(...operations);
		}
		return;
	} else if (isTestContext(executionContext)) {
        const serverConnector = executionContext.serverConnector();
        await Promise.all(refs.map(docRef => {
            const params: Record<string, unknown> = { docRef: docRef.toString() };
            return callRpc(serverConnector, 'DELETE_DOCUMENT', params);
        }));
        return;
	}

	throw new UnsupportedContextError('Documents.remove');
}

function createUsingDocumentService(
	documentModelName: DocumentModelName,
	document?: object,
	locale?: string,
): DocumentReference {
	try {
		let doc: DocumentV2;
		if (document) {
			doc = isDocumentV2(document) ? document : toDocumentV2(JSON.stringify(document), documentModelName);
		} else {
			const StringReader = getStringReaderJavaClass();
			const reader = new StringReader('{}');
			const config = getDocumentDeserializationConfigJavaClass().builder().build();
			doc = (executionContext as DataServicesContext).documentV2Serializer[
				'deserializeV2(java.io.Reader,java.lang.String,com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig,java.util.function.Consumer)'
			](reader, documentModelName, config, () => {});
		}

		Log.info('Calling Java: DocumentService.create(DocumentV2, Locale)');
		const javaDocRef = (executionContext as DataServicesContext).documentService[
			'create(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale)'
		](doc, toJavaLocale(locale) ?? null)
			.getMetadata()
			.getDocRef();
		return DocumentReference.fromString(javaDocRef.toString());
	} catch (error) {
		throw mapDsError(error, { operationName: 'Documents.create', documentModelName });
	}
}