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

import { Relationship } from '@com.mgmtp.a12.dataservices/dataservices-access';

import { JavaInstant, JavaList, JavaSet } from '../java-util-typings/index.js';

import { DocumentReference } from './DocumentReference.js';

/**
 * A relationship link between two documents.
 * @see com.mgmtp.a12.dataservices.relationship.RelationshipLink
 */
export interface RelationshipLink {
	getId(): string;
	getRelationshipModel(): string;
	getCreatedAt(): JavaInstant;
	getLinkDocumentDocRef(): DocumentReference | null;
	/**
	 * A java.util.Map<String, RelationshipRole>. Opaque because RelationshipRole is not declared
	 * here — declare it, and narrow this return type, at the point something reads the roles.
	 */
	getRoles(): object;
}

/**
 * Filter specification for one side of a relationship link query.
 * This is a Java record — accessors use the component name directly (no "get" prefix).
 * @see com.mgmtp.a12.dataservices.relationship.RelationshipLinkSpecification.RelationshipRoleSpecification
 */
export interface RelationshipRoleSpecification {
	name(): string;
	docRef(): DocumentReference;
}

/**
 * Specification for querying relationship links.
 * @see com.mgmtp.a12.dataservices.relationship.RelationshipLinkSpecification
 */
export interface RelationshipLinkSpecification {
	getRelationshipModelName(): string;
	getSourceFilter(): RelationshipRoleSpecification | null;
	getTargetFilter(): RelationshipRoleSpecification | null;
	setSourceFilter(filter: RelationshipRoleSpecification): void;
	setTargetFilter(filter: RelationshipRoleSpecification): void;
}

/**
 * Spring Data Pageable for pagination.
 * Opaque: a Pageable is handed to Java calls, never read from TypeScript.
 * @see org.springframework.data.domain.Pageable
 */
export type Pageable = object;

/**
 * One side of a relationship link: the role name and the document that fills it.
 * Opaque: a role spec is handed to Java calls, never read from TypeScript.
 * @see com.mgmtp.a12.dataservices.relationship.spec.RelationshipRoleSpec
 */
export type RelationshipRoleSpec = object;

/**
 * Java class proxy for RelationshipRoleSpec, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.relationship.spec.RelationshipRoleSpec
 */
export interface RelationshipRoleSpecJavaClass {
	new (role: string, docRef: DocumentReference): RelationshipRoleSpec;
}

/**
 * Java class proxy for LinkDescriptor, as returned by {@link Java.type}.
 * The role specs are passed as a JavaScript array, which GraalJS coerces to the java.util.List the
 * constructor takes. The instance is typed as `Relationship.LinkDescriptor` to match the existing
 * imprecision in the service bindings below, which describe Java POJO parameters in their
 * JS-property shape.
 * @see com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor
 */
export interface LinkDescriptorJavaClass {
	new (relationshipModel: string, entities: RelationshipRoleSpec[]): Relationship.LinkDescriptor;
}

/**
 * Spring Data Page — paginated result of a query.
 * @see org.springframework.data.domain.Page
 */
export interface SpringPage<T> {
	getContent(): JavaList<T>;
	getTotalElements(): number;
	getTotalPages(): number;
	getNumberOfElements(): number;
	hasNext(): boolean;
}

/**
 * Service for managing relationship links between documents.
 * Provides CRUD operations for links and their associated link documents.
 *
 * @see com.mgmtp.a12.dataservices.relationship.RelationshipLinkService
 */
export interface RelationshipLinkService {
	/**
	 * Creates a new link between documents.
	 *
	 * @param linkDescriptor - Descriptor specifying the relationship and linked documents
	 * @returns The created RelationshipLink
	 */
	'create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor)'(
		linkDescriptor: Relationship.LinkDescriptor,
	): RelationshipLink;

	/**
	 * Creates a new link between documents with a link document (as JSON string).
	 *
	 * @param linkDescriptor - Descriptor specifying the relationship and linked documents
	 * @param linkDocument - Link document as JSON string
	 * @returns The created RelationshipLink
	 */
	'create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor,java.lang.String)'(
		linkDescriptor: Relationship.LinkDescriptor,
		linkDocument: string,
	): RelationshipLink;

	/**
	 * Creates a new link between documents with a link document reference.
	 *
	 * @param linkDescriptor - Descriptor specifying the relationship and linked documents
	 * @param linkDocRef - Document reference to existing link document
	 * @returns The created RelationshipLink
	 */
	'create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor,com.mgmtp.a12.dataservices.document.DocumentReference)'(
		linkDescriptor: Relationship.LinkDescriptor,
		linkDocRef: DocumentReference,
	): RelationshipLink;

	/**
	 * Updates an existing relationship link.
	 *
	 * @param id - The link ID to update
	 * @param linkDescriptor - The new descriptor for the link
	 * @param linkDocument - The new link document as JSON string (or null)
	 * @returns The updated RelationshipLink
	 */
	'update(java.lang.String,com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor,java.lang.String)'(
		id: string,
		linkDescriptor: Relationship.LinkDescriptor,
		linkDocument: string | null,
	): RelationshipLink;

	/**
	 * Deletes a link by its ID.
	 *
	 * @param id - The link ID to delete
	 */
	'delete(java.lang.String)'(id: string): void;

	/**
	 * Deletes all relationship links with the specified IDs.
	 *
	 * @param ids - Set of link IDs to delete. A JavaScript `Set` is not accepted here: build the
	 *              java.util.Set with `Java.to(ids, 'java.util.Set')`.
	 */
	'deleteAllByIds(java.util.Set)'(ids: JavaSet<string>): void;

	/**
	 * Loads a link by its ID.
	 *
	 * @param id - The link ID to load
	 * @returns The loaded RelationshipLink
	 * @throws NotFoundException if link not found
	 */
	'load(java.lang.String)'(id: string): RelationshipLink;

	/**
	 * Loads a page of relationship links matching the given specification.
	 *
	 * @param specification - Filter criteria for the query
	 * @param pageable - Pagination parameters (e.g. PageRequest.of(0, 100))
	 * @returns A page of RelationshipLinks
	 */
	'load(com.mgmtp.a12.dataservices.relationship.RelationshipLinkSpecification,org.springframework.data.domain.Pageable)'(
		specification: RelationshipLinkSpecification,
		pageable: Pageable,
	): SpringPage<RelationshipLink>;

	/**
	 * Relinks an existing relationship link with a new descriptor.
	 * Preserves the link document.
	 *
	 * @param linkDescriptor - The new descriptor for the link
	 * @param linkId - The existing link ID to relink
	 * @returns The relinked RelationshipLink
	 */
	'relink(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor,java.lang.String)'(
		linkDescriptor: Relationship.LinkDescriptor,
		linkId: string,
	): RelationshipLink;

	/**
	 * Deletes relationship links by their role document references.
	 *
	 * @param documentReferences - Collection of document references whose links to delete
	 */
	'deleteByRoleDocRefs(java.util.Collection)'(documentReferences: DocumentReference[]): void;
}
