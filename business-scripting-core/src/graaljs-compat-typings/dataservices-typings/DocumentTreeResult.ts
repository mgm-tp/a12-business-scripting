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

import { JacksonJsonNode } from '../jackson-typings/index.js';

import { DocumentReference } from './DocumentReference.js';

/**
 * JSON-deserialized shape of DocumentTreeResult, as returned by the RPC facade.
 * DocumentReference fields are serialized as strings by Jackson.
 * Fields absent for ROOT nodes are optional (@JsonInclude NON_EMPTY).
 * @see com.mgmtp.a12.dataservices.query.DocumentTreeResult
 */
export interface DocumentTreeResultJson {
	/** Document reference string of this node. */
	docRef: string;
	/** Node type: ROOT, CHILD, or LINK. */
	type: 'ROOT' | 'CHILD' | 'LINK';
	/** Depth of this node in the tree. Always present. */
	depth: number;
	/** Document content. Always present (@JsonInclude ALWAYS), may be null. */
	document: unknown;
	/** ID of the relationship link (absent for ROOT nodes). */
	linkId?: string;
	/** Relationship model name (absent for ROOT nodes). */
	relationshipModel?: string;
	/** Role of the source document in the link (absent for ROOT nodes). */
	sourceRole?: string;
	/** Source document reference string (absent for ROOT nodes). */
	sourceDocRef?: string;
	/** Role of the target document in the link (absent for ROOT nodes). */
	targetRole?: string;
	/** Target document reference string (absent for ROOT nodes). */
	targetDocRef?: string;
	/** Back-reference string pairing query and response topology nodes. */
	backReference?: string;
}

/**
 * Java enum for the type of a DocumentTreeResult node.
 * Use `.toString()` or `.name()` to compare: `getType().toString() === 'ROOT'`.
 * @see com.mgmtp.a12.dataservices.query.DocumentTreeNodeType
 */
export interface DocumentTreeNodeType {
	toString(): 'ROOT' | 'CHILD' | 'LINK';
	name(): 'ROOT' | 'CHILD' | 'LINK';
	ordinal(): number;
}

/**
 * Single document node in a document graph query result.
 * @see com.mgmtp.a12.dataservices.query.DocumentTreeResult
 */
export interface DocumentTreeResult {
	/** Document reference of this node. */
	getDocRef(): DocumentReference;
	/** Document model name — shorthand for `getDocRef().getDocumentModelName()`. */
	getDocumentModelName(): string;
	/** Node type: ROOT, CHILD, or LINK. */
	getType(): DocumentTreeNodeType;
	/** Depth of this node in the tree. */
	getDepth(): number;
	/** Document content as a Jackson JsonNode. */
	getDocument(): JacksonJsonNode;
	/** ID of the relationship link (null for ROOT nodes). */
	getLinkId(): string | null;
	/** Relationship model name (null for ROOT nodes). */
	getRelationshipModel(): string | null;
	/** Role of the source document in the link (null for ROOT nodes). */
	getSourceRole(): string | null;
	/** Source document reference (null for ROOT nodes). */
	getSourceDocRef(): DocumentReference | null;
	/** Role of the target document in the link (null for ROOT nodes). */
	getTargetRole(): string | null;
	/** Target document reference (null for ROOT nodes). */
	getTargetDocRef(): DocumentReference | null;
	/** Back-reference string pairing query and response topology nodes. */
	getBackReference(): string | null;
}
