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

import { RelationshipJsonRpc2response } from '@com.mgmtp.a12.dataservices/dataservices-access';

import { Constraint } from '../../api/types.js';

import { DocumentReference, JavaDocumentPart } from '../dataservices-typings/index.js';
import { DocumentV2 } from '../kernel-typings/index.js';
import { Locale } from '../java-util-typings/index.js';

import LinkDescriptor = RelationshipJsonRpc2response.LinkDescriptor;

/**
 * TypeScript interface for the Kotlin DataServicesRpcFacade.
 * Provides RPC operations for document management in non-DataServices contexts (e.g., CIB 7).
 *
 * @see com.mgmtp.a12.arch.scripting.cibseven.a12.DataServicesRpcFacade
 */
export interface DataServicesRpcFacade {
	// --- Batch Operations ---

	/**
	 * Performs a batch call of multiple JSON-RPC methods in one request.
	 * @param batch - An array of objects each containing a method name and its parameters
	 * @returns Array of results with type corresponding to called method
	 */
	batchCall(batch: Array<{ method: string; params: any }>): any[];

	// --- Document CRUD ---

	/**
	 * Adds a new document to the data services system.
	 *
	 * @param docModelName - The name of the document model/type
	 * @param document - Optional initial document data (as DocumentV2 or JSON)
	 * @param locale - Optional locale used for validation
	 * @returns A DocumentReference containing the reference to the newly created document
	 */
	tryAddDocument(docModelName: string, document: DocumentV2 | object | undefined, locale?: Locale): DocumentReference;

	/**
	 * Copies a document to a new one in the data services system.
	 * @param docRefString - The document reference of the document to copy
	 * @param locale - Optional locale used for validation
	 * @returns The document reference of the newly created copy
	 */
	tryCopyDocument(docRefString: string, locale?: Locale): string;

	/**
	 * Deletes a document from the data services system.
	 * @param docRefString - The document reference of the document to delete
	 * @param locale - Optional locale used for validation
	 */
	tryDeleteDocument(docRefString: string, locale?: Locale): void;

	/**
	 * Modifies a document in the data services system.
	 *
	 * @param docRefString - The document reference of the document to modify
	 * @param document - The updated document (as DocumentV2 for 2024.06 compatibility)
	 * @param locale - Optional locale used for validation
	 */
	tryModifyDocument(docRefString: string, document: DocumentV2, locale?: Locale): void;

	/**
	 * Modifies a document in the data services system from JSON directly.
	 * Avoids unnecessary DocumentV2 conversion roundtrip when source is already JSON.
	 *
	 * @param docRefString - The document reference of the document to modify
	 * @param json - The updated document as JSON string
	 * @param locale - Optional locale used for validation
	 */
	tryModifyDocumentFromJson(docRefString: string, json: string, locale?: Locale): void;

	/**
	 * Partially modifies a document by updating specific fields.
	 *
	 * @param docRefString - The document reference of the document to modify
	 * @param documentParts - The parts of the document to change, as Java DocumentPart instances
	 *                        built by `toJavaDocumentPart`
	 * @param locale - Optional locale used for validation
	 */
	tryPartialModifyDocument(docRefString: string, documentParts: JavaDocumentPart[], locale?: Locale): void;

	// --- Document Queries ---

	/**
	 * Gets a document from the data services system.
	 *
	 * @param docRefString - The document reference to load the document for
	 * @returns The loaded document as DocumentV2
	 */
	tryGetDocument(docRefString: string): DocumentV2 | undefined;

	/**
	 * Gets a document from the data services system as JSON string.
	 *
	 * @param docRefString - The document reference to load the document for
	 * @returns The document as JSON string, or undefined if not found
	 */
	tryGetDocumentAsJson(docRefString: string): string | undefined;

	/**
	 * Lists documents matching the given document model and optional constraint.
	 * @param documentModelName - The name of the document model to query
	 * @param constraint - Optional constraint for filtering documents
	 * @returns List of document reference strings matching the criteria
	 */
	tryListDocuments(
		documentModelName: string,
		constraint?: Constraint,
	): string[];

	// --- Link Operations ---

	/**
	 * Creates a relationship link incl. link document in the data services system.
	 *
	 * @param linkDescriptor - The spec for the link containing relationship model name, both roles and both docRefs
	 * @param linkDocument - The document to use as link document (as DocumentV2 or JSON object)
	 * @returns the created Link ID
	 */
	tryAddLink(linkDescriptor: LinkDescriptor, linkDocument?: DocumentV2 | object): string;

	/**
	 * Deletes a relationship link.
	 *
	 * @param linkSpec - The link spec containing id and linkDescriptor
	 */
	tryDeleteLink(linkSpec: { id: string; linkDescriptor: LinkDescriptor }): void;

	/**
	 * Lists linked entities for a given document reference and role in a relationship.
	 * @param relationshipModelName - the name of the relationship model to consider
	 * @param docRefString - the (root) document to find other documents linked to it
	 * @param roleName - the role of the (root) document
	 */
	tryListLinks(relationshipModelName: string, docRefString: string, roleName: string): string;

	// --- Serialization / Deserialization ---

	/**
	 * Serializes an DocumentV2 to JSON string.
	 *
	 * @param document - The DocumentV2 to serialize
	 * @returns JSON string representation of the document
	 */
	documentV2ToJson(document: DocumentV2): string;

	/**
	 * Deserializes JSON to DocumentV2
	 *
	 * @param json - The JSON string to deserialize
	 * @param documentModelId - The document model ID
	 * @returns The deserialized DocumentV2
	 */
	jsonToDocumentV2(json: string, documentModelId: string): DocumentV2;

	// --- Callable Script Operations ---

	tryCallScript(scriptName: string, args: Map<string, any>): string | undefined;
}

