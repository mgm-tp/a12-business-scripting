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

import { rpcResultsToLinkSpecs, toDsLinkDescriptor } from '../../../internal/link-utils.js';
import { DocumentReference } from '../../document-reference.js';
import { SimpleList } from '../../simple-list.js';
import { LinkId, RelationshipLinkDescriptor, RelationshipLinkSpec, RelationshipModelName, Role } from '../../types.js';

import { BatchOperation, RPC_METHODS } from './batch-api.js';

/**
 * Link-related batch operations.
 * Mirrors A12.Links methods that support batching.
 */

/**
 * Creates a relationship link between two documents in a specific relationship.
 * @param linkSpec - The link descriptor including RM name, roles and docRefs.
 * @param linkDoc - Optional link document to attach to the link, as a plain JSON object.
 * @returns The created link ID.
 */
export function create(linkSpec: RelationshipLinkDescriptor, linkDoc?: object): BatchOperation<LinkId> {
	return {
		methodName: RPC_METHODS.LINKS_CREATE,
		params: {
			linkDescriptor: toDsLinkDescriptor(linkSpec),
			linkDocument: linkDoc,
		},
		transformResult: (raw: unknown) => raw as string,
	};
}

/**
 * Finds relationship links for a document and role.
 * @param relationshipModelName - The relationship model to consider.
 * @param docRef - The (root) document to find links for.
 * @param role - The role of the linked documents in the relationship model (QueryLink targetRole).
 * @param linkedDocRefs - Optional list of linked document references for local filtering.
 * @returns A SimpleList of RelationshipLinkSpec objects representing the found links.
 */
export function find(
	relationshipModelName: RelationshipModelName,
	docRef: DocumentReference,
	role: Role,
	linkedDocRefs?: DocumentReference[],
): BatchOperation<SimpleList<RelationshipLinkSpec>> {
	return {
		methodName: RPC_METHODS.LINKS_FIND,
		params: {
			relationshipModelName,
			docRef: docRef.toString(),
			role,
		},
		transformResult: (raw: unknown) => {
			// Batch returns JSON string, parse it first
			const entries = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return new SimpleList(rpcResultsToLinkSpecs(entries, docRef, linkedDocRefs));
		},
	};
}

/**
 * Removes a relationship link.
 * @param linkSpec - The link to remove (with id and linkDescriptor).
 */
export function remove(linkSpec: RelationshipLinkSpec): BatchOperation<void> {
	return {
		methodName: RPC_METHODS.LINKS_REMOVE,
		params: {
			linkSpec: {
				id: linkSpec.id,
				linkDescriptor: toDsLinkDescriptor(linkSpec.linkDescriptor),
			},
		},
	};
}

/**
 * Gets document references of linked documents.
 * Convenience wrapper around find() that extracts target document references.
 * @param relationshipModelName - The relationship model to consider.
 * @param docRef - The (root) document to find links for.
 * @param role - The role of the linked documents in the relationship model (QueryLink targetRole).
 * @returns Array of document references of the linked documents.
 */
export function getLinkedDocuments(
	relationshipModelName: RelationshipModelName,
	docRef: DocumentReference,
	role: Role,
): BatchOperation<DocumentReference[]> {
	return {
		methodName: RPC_METHODS.LINKS_FIND,
		params: {
			relationshipModelName,
			docRef: docRef.toString(),
			role,
		},
		transformResult: (raw: unknown) => {
			const entries = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return rpcResultsToLinkSpecs(entries, docRef).map((spec) => spec.linkDescriptor.targetDocRef);
		},
	};
}

