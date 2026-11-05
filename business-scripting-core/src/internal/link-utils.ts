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

import {Query, Relationship} from '@com.mgmtp.a12.dataservices/dataservices-access';

import { RelationshipLinkDescriptor, RelationshipLinkSpec, Role } from '../api/types.js';
import {
	DocumentTreeResult,
	DocumentTreeResultJson,
	JavaList,
	RelationshipRoleSpec,
} from '../graaljs-compat-typings/index.js';
import { DocumentReference } from '../api/index.js';

import {
	getDocumentReferenceJavaClass,
	getLinkDescriptorJavaClass,
	getRelationshipRoleSpecJavaClass,
} from './java-classes.js';

import DocumentTreeNodeType = Query.DocumentTreeNodeType;

// =============================================================================
// Relationship Links
// =============================================================================

/**
 * Converts DocumentTreeResult query results to RelationshipLinkSpec[].
 * Only CHILD nodes carry link data; ROOT and LINK nodes are skipped.
 * LINK nodes are used to populate linkDocRef on their corresponding CHILD spec.
 * Roles are derived from entry.sourceDocRef: if it matches docRef, docRef is the source;
 * otherwise docRef is the target (queried from the other side of the relationship).
 */
export function dsResultsToLinkSpecs(
	entries: JavaList<DocumentTreeResult>,
	docRef: DocumentReference,
	linkedDocRefs?: DocumentReference[],
): RelationshipLinkSpec[] {
	const specs: RelationshipLinkSpec[] = [];

	const linkDocRefByLinkId = new Map<string, DocumentReference>();
	for (let i = 0; i < entries.size(); i++) {
		const entry = entries.get(i);
		if (entry.getType().toString() === 'LINK' && entry.getLinkId()) {
			linkDocRefByLinkId.set(entry.getLinkId()!, DocumentReference.fromString(entry.getDocRef().toString()));
		}
	}

	for (let i = 0; i < entries.size(); i++) {
		const entry = entries.get(i);

		if (entry.getType().toString() !== 'CHILD') {
			continue;
		}

		const linkId = entry.getLinkId();
		const relationshipModel = entry.getRelationshipModel();
		const entrySourceRole = entry.getSourceRole();
		const entryTargetRole = entry.getTargetRole();
		const entrySourceDocRef = entry.getSourceDocRef();
		if (!linkId || !relationshipModel || !entrySourceRole || !entryTargetRole || !entrySourceDocRef) {
			continue;
		}

		const linkedDocRef = DocumentReference.fromString(entry.getDocRef().toString());

		if (!passesLinkedDocRefsFilter(linkedDocRef, linkedDocRefs)) {
			continue;
		}

		const docRefIsSource = entrySourceDocRef.toString() === docRef.toString();
		const specSourceRole = docRefIsSource ? entrySourceRole : entryTargetRole;
		const specTargetRole = docRefIsSource ? entryTargetRole : entrySourceRole;

		const linkDocRef = linkDocRefByLinkId.get(linkId);
		specs.push(
			buildLinkSpec(
				linkId,
				relationshipModel,
				specSourceRole,
				docRef,
				{ role: specTargetRole, docRef: linkedDocRef },
				linkDocRef,
			),
		);
	}

	return specs;
}

/**
 * Checks if targetDocRef passes the linkedDocRefs filter.
 */
export function passesLinkedDocRefsFilter(
	targetDocRef: DocumentReference,
	linkedDocRefs?: DocumentReference[],
): boolean {
	return !linkedDocRefs?.length || linkedDocRefs.some((ref) => ref.toString() === targetDocRef.toString());
}

/** Builds a RelationshipLinkSpec from extracted data. */
function buildLinkSpec(
	id: string,
	relationshipModelName: string,
	sourceRole: Role,
	sourceDocRef: DocumentReference,
	target: { role: string; docRef: DocumentReference },
	linkDocRef?: DocumentReference,
): RelationshipLinkSpec {
	return {
		id,
		linkDescriptor: {
			relationshipModelName,
			sourceRole,
			sourceDocRef,
			targetRole: target.role,
			targetDocRef: target.docRef,
		},
		...(linkDocRef !== undefined && { linkDocRef }),
	};
}

/**
 * Converts RPC DocumentTreeResult entries to RelationshipLinkSpec[].
 * Only CHILD nodes carry link data; ROOT and LINK nodes are skipped.
 * LINK nodes are used to populate linkDocRef on their corresponding CHILD spec.
 * Roles are derived from entry.sourceDocRef: if it matches docRef, docRef is the source;
 * otherwise docRef is the target (queried from the other side of the relationship).
 */
export function rpcResultsToLinkSpecs(
	linkResults: DocumentTreeResultJson[],
	docRef: DocumentReference,
	linkedDocRefs?: DocumentReference[],
): RelationshipLinkSpec[] {
	const specs: RelationshipLinkSpec[] = [];

	const linkDocRefByLinkId = new Map<string, DocumentReference>();
	for (const entry of linkResults) {
		if (entry.type === DocumentTreeNodeType.LINK && entry.linkId) {
			linkDocRefByLinkId.set(entry.linkId, DocumentReference.fromString(entry.docRef));
		}
	}

	for (const entry of linkResults) {
		if (entry.type !== DocumentTreeNodeType.CHILD) {
			continue;
		}

		if (!entry.linkId || !entry.relationshipModel || !entry.sourceRole || !entry.targetRole || !entry.sourceDocRef) {
			continue;
		}

		const linkedDocRef = DocumentReference.fromString(entry.docRef);

		if (!passesLinkedDocRefsFilter(linkedDocRef, linkedDocRefs)) {
			continue;
		}

		const docRefIsSource = entry.sourceDocRef === docRef.toString();
		const specSourceRole = docRefIsSource ? entry.sourceRole : entry.targetRole;
		const specTargetRole = docRefIsSource ? entry.targetRole : entry.sourceRole;

		const linkDocRef = linkDocRefByLinkId.get(entry.linkId);
		specs.push(
			buildLinkSpec(
				entry.linkId,
				entry.relationshipModel,
				specSourceRole,
				docRef,
				{ role: specTargetRole, docRef: linkedDocRef },
				linkDocRef,
			),
		);
	}

	return specs;
}

/**
 * Converts a RelationshipLinkDescriptor to the DS LinkDescriptor format.
 * Returns a plain object (for RPC) or a Java object (for direct DS calls) based on context.
 *
 * Both branches are typed as `Relationship.LinkDescriptor` to match the existing imprecision
 * in our Java service bindings, which describe Java POJO parameters in their JS-property shape.
 */
export function toDsLinkDescriptor(
	linkDescriptor: RelationshipLinkDescriptor,
	asJavaObject = false,
): Relationship.LinkDescriptor {
	if (asJavaObject) {
		return toJavaLinkDescriptor(linkDescriptor);
	}

	return {
		relationshipModel: linkDescriptor.relationshipModelName,
		entities: [
			{ role: linkDescriptor.sourceRole, docRef: linkDescriptor.sourceDocRef.toString() },
			{ role: linkDescriptor.targetRole, docRef: linkDescriptor.targetDocRef.toString() },
		],
	};
}

/**
 * Builds a Java LinkDescriptor with its source and target role spec. The remaining fields
 * (link document doc ref, predecessor link ref, position) stay at their Java defaults.
 */
function toJavaLinkDescriptor(linkDescriptor: RelationshipLinkDescriptor): Relationship.LinkDescriptor {
	const LinkDescriptor = getLinkDescriptorJavaClass();
	return new LinkDescriptor(linkDescriptor.relationshipModelName, [
		toJavaRoleSpec(linkDescriptor.sourceRole, linkDescriptor.sourceDocRef),
		toJavaRoleSpec(linkDescriptor.targetRole, linkDescriptor.targetDocRef),
	]);
}

function toJavaRoleSpec(role: Role, docRef: DocumentReference): RelationshipRoleSpec {
	const JavaRelationshipRoleSpec = getRelationshipRoleSpecJavaClass();
	const JavaDocumentReference = getDocumentReferenceJavaClass();
	return new JavaRelationshipRoleSpec(role, new JavaDocumentReference(docRef.toString()));
}
