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

import { dsResultsToLinkSpecs, rpcResultsToLinkSpecs, toDsLinkDescriptor, } from '../../internal/link-utils.js';
import {
    DocumentTreeResult,
    DocumentTreeResultJson,
    QueryPage,
} from '../../graaljs-compat-typings/index.js';
import { documentToJson } from '../../internal/document-utils.js';
import { mapDsError } from '../../internal/ds-error-mapper.js';
import { mapRpcError } from '../../internal/rpc-error-mapper.js';
import { callRpc, callRpcBatch } from '../../internal/rpc.js';
import { FIRST_PAGE, PAGE_SIZE_LIMIT } from "../../internal/constants.js";
import { getPagingJavaClass, getQueryLinkJavaClass, getQueryRootJavaClass } from '../../internal/java-classes.js';

import { SimpleList } from '../simple-list.js';
import { DocumentReference } from '../document-reference.js';
import { executionContext, isDataServicesContext, isTestContext, isWorkflowContext, } from '../execution-contexts.js';
import { UnsupportedContextError } from '../errors.js';
import { LinkId, RelationshipLinkDescriptor, RelationshipLinkSpec, RelationshipModelName, Role } from '../types.js';

import * as Log from './logging.js';
import * as Batch from './batch/index.js';

/**
 * Functionality about A12 Relationship Links.
 * @public
 */

/**
 * Creates a single link between two documents.
 * @param linkDescriptor - The link descriptor including RM name, roles and docRefs.
 * @param linkDocument - Optional link document to attach to the link, as a plain JSON object.
 * @returns The created LinkId.
 *
 * @example
 * ```ts
 * // Without link document
 * const linkId = A12.Links.create({
 *     relationshipModelName: "Project_Employee_RM",
 *     sourceRole: "Project",
 *     sourceDocRef: projectDocRef,
 *     targetRole: "Employee",
 *     targetDocRef: employeeDocRef
 *   }
 * )
 *
 * // With link document
 * const linkId = A12.Links.create({
 *     relationshipModelName: "Project_Employee_RM",
 *     sourceRole: "Project",
 *     sourceDocRef: projectDocRef,
 *     targetRole: "Employee",
 *     targetDocRef: employeeDocRef
 *   }, { Assignment: { Allocation: 50 } }
 * )
 * ```
 */
export function create(linkDescriptor: RelationshipLinkDescriptor, linkDocument?: object): Promise<LinkId>;
/**
 * Creates multiple links at once.
 * @param linkSpecs - Array of link specs, each with a linkDescriptor and optional linkDocument.
 * @returns A SimpleList of the created LinkIds.
 *
 * @example
 * ```ts
 * const linkIdList = await A12.Links.create([
 *      // without link document
 *      {
 *          linkDescriptor: {
 *              relationshipModelName: "Project_Employee_RM",
 *              sourceRole: "Project",
 *              sourceDocRef: projectDocRef,
 *              targetRole: "Employee",
 *              targetDocRef: employeeDocRef1
 *          }
 *      },
 *      // with link document
 *      {
 *          linkDescriptor: {
 *              relationshipModelName: "Project_Employee_RM",
 *              sourceRole: "Project",
 *              sourceDocRef: projectDocRef,
 *              targetRole: "Employee",
 *              targetDocRef: employeeDocRef2
 *          },
 *          linkDocument: { Assignment: { Allocation: 50 } }
 *      }
 * ])
 * ```
 */
export function create(
	linkSpecs: { linkDescriptor: RelationshipLinkDescriptor; linkDocument?: object }[],
): Promise<SimpleList<LinkId>>;
export async function create(
	linkDescriptorOrSpecs:
		| RelationshipLinkDescriptor
		| { linkDescriptor: RelationshipLinkDescriptor; linkDocument?: object }[],
	linkDocument?: object,
): Promise<LinkId | SimpleList<LinkId>> {
	const isArray = Array.isArray(linkDescriptorOrSpecs);
	const specs = isArray ? linkDescriptorOrSpecs : [{ linkDescriptor: linkDescriptorOrSpecs, linkDocument }];

	if (specs.length === 0) {
		return new SimpleList<LinkId>([]);
	}

	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: RelationshipLinkService.create(LinkDescriptor)');
		const dsContext = executionContext;
		try {
			const results = specs.map(({ linkDescriptor, linkDocument }) => {
				const dsDescriptor = toDsLinkDescriptor(linkDescriptor, true);
				const result = linkDocument
					? dsContext.relationshipLinkService[
							'create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor,java.lang.String)'
						](dsDescriptor, documentToJson(linkDocument))
					: dsContext.relationshipLinkService['create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor)'](
							dsDescriptor,
						);
				return result.getId();
			});
			return isArray ? new SimpleList(results) : results[0]!;
		} catch (error) {
			throw mapDsError(error, { operationName: 'Links.create', relationshipModelName: specs[0]!.linkDescriptor.relationshipModelName });
		}
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		if (!isArray) {
			try {
				return executionContext.dataServicesRpcFacade.tryAddLink(
					toDsLinkDescriptor(specs[0]!.linkDescriptor),
					specs[0]!.linkDocument,
				);
			} catch (error) {
				throw mapRpcError(error, { operationName: 'Links.create', relationshipModelName: specs[0]!.linkDescriptor.relationshipModelName });
			}
		}
		const operations = specs.map(({ linkDescriptor, linkDocument }) =>
			Batch.Links.create(linkDescriptor, linkDocument),
		);
		const batchResults = Batch.call(...operations);
		return new SimpleList(operations.map((op) => batchResults.get(op)));
	} else if (isTestContext(executionContext)) {
		const connector = executionContext.serverConnector();
		const ids = await Promise.all(
			specs.map(async ({ linkDescriptor, linkDocument: doc }) => {
				const params: Record<string, unknown> = { linkDescriptor: toDsLinkDescriptor(linkDescriptor) };
				if (doc) { params.linkDocument = doc; }
				const result = await callRpc(connector, 'ADD_LINK', params);
				return result['id'] as string;
			}),
		);
		return isArray ? new SimpleList(ids) : ids[0]!;
	}

	throw new UnsupportedContextError('Links.create');
}

/**
 * Deletes a single link. A link id that no longer exists is skipped.
 * @param linkSpec - The link specification to delete (from Links.find).
 * @throws {LinkSpecIncompleteError} If the spec is missing a role name or document reference.
 * @throws {LinkSpecMismatchError} If the spec does not match the stored link.
 *
 * @example
 * ```ts
 * A12.Links.remove(
 *      {
 *          id: linkId,
 *          linkDescriptor:
 *              {
 *                  relationshipModelName: "Project_Employee_RM",
 *                  sourceRole: "Project",
 *                  sourceDocRef: projectDocRef,
 *                  targetRole: "Employee",
 *                  targetDocRef: employeeDocRef
 *              }
 *      }
 * )
 * ```
 */
export function remove(linkSpec: RelationshipLinkSpec): Promise<void>;
/**
 * Deletes multiple links. Link ids that no longer exist are skipped.
 * @param linkSpecs - The link specifications to delete (from Links.find).
 * @throws {LinkSpecIncompleteError} If a spec is missing a role name or document reference.
 * @throws {LinkSpecMismatchError} If a spec does not match its stored link.
 *
 * @example
 * ```ts
 * await A12.Links.remove([
 *      {
 *          id: linkId1,
 *          linkDescriptor:
 *              {
 *                  relationshipModelName: "Project_Employee_RM",
 *                  sourceRole: "Project",
 *                  sourceDocRef: projectDocRef,
 *                  targetRole: "Employee",
 *                  targetDocRef: employeeDocRef1
 *              }
 *      },
 *      {
 *          id: linkId2,
 *          linkDescriptor:
 *              {
 *                  relationshipModelName: "Project_Employee_RM",
 *                  sourceRole: "Project",
 *                  sourceDocRef: projectDocRef,
 *                  targetRole: "Employee",
 *                  targetDocRef: employeeDocRef2
 *              }
 *      }
 * ])
 * ```
 */
export function remove(linkSpecs: RelationshipLinkSpec[]): Promise<void>;
export async function remove(linkSpecOrSpecs: RelationshipLinkSpec | RelationshipLinkSpec[]): Promise<void> {
	const specs = Array.isArray(linkSpecOrSpecs) ? linkSpecOrSpecs : [linkSpecOrSpecs];

	if (specs.length === 0) {
		return;
	}

	if (isDataServicesContext(executionContext)) {
		try {
			// Every spec is verified before any delete, so a list with one bad spec deletes nothing
			for (const spec of specs) {
				executionContext.linkSpecVerifier.verifyLinkSpecIsCompleteAndMatchesStoredLink(spec.id, toDsLinkDescriptor(spec.linkDescriptor, true));
			}
			for (const spec of specs) {
				executionContext.relationshipLinkService['delete(java.lang.String)'](spec.id);
			}
		} catch (error) {
			throw mapDsError(error, { operationName: 'Links.remove', relationshipModelName: specs[0]!.linkDescriptor.relationshipModelName });
		}
		return;
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		if (specs.length === 1) {
			try {
				const rpcSpec = { id: specs[0]!.id, linkDescriptor: toDsLinkDescriptor(specs[0]!.linkDescriptor) };
				executionContext.dataServicesRpcFacade.tryDeleteLink(rpcSpec);
			} catch (error) {
				throw mapRpcError(error, { operationName: 'Links.remove', relationshipModelName: specs[0]!.linkDescriptor.relationshipModelName });
			}
		} else {
			const operations = specs.map((spec) => Batch.Links.remove(spec));
			Batch.call(...operations);
		}
		return;
	} else if (isTestContext(executionContext)) {
		const connector = executionContext.serverConnector();
		try {
			// One batch, so a list with one bad spec deletes nothing, as in the script contexts
			await callRpcBatch(
				connector,
				specs.map((spec) => ({
					method: 'DELETE_LINK',
					params: { linkRef: { id: spec.id, linkDescriptor: toDsLinkDescriptor(spec.linkDescriptor) } },
				})),
			);
		} catch (error) {
			throw mapRpcError(error, { operationName: 'Links.remove', relationshipModelName: specs[0]!.linkDescriptor.relationshipModelName });
		}
		return;
	}

	throw new UnsupportedContextError('Links.remove');
}

/**
 * Fetches a relationship link specification for a given document and in a given role of a given relationship model.
 * If linkedDocRefs is provided, only links to those documents are returned.
 * @param relationshipModelName - The name of the relationship model to query.
 * @param docRef - The document reference in the root role.
 * @param targetRole - The role of the linked documents in the relationship model (QueryLink targetRole).
 * @param linkedDocRefs - Optional array of document references to filter the linked documents.
 * @returns A SimpleList of RelationshipLinkSpec objects representing the found links.
 *
 * @example
 * ```ts
 * // Without linked docRefs
 * const result = A12.Links.find("Project_Employee_RM", projectDocRef, "Employee")
 *
 * // With linked docRefs
 * const relationshipLinkSpecList = A12.Links.find("Project_Employee_RM", projectDocRef, "Employee", [employeeDocRef1, employeeDocRef2])
 * ```
 */
export async function find(
    relationshipModelName: RelationshipModelName,
    docRef: DocumentReference,
    targetRole: Role,
    linkedDocRefs?: DocumentReference[],
): Promise<SimpleList<RelationshipLinkSpec>> {
	if (isDataServicesContext(executionContext)) {
		Log.info('Calling Java: QueryService.query(QueryRoot with QueryLink, locale)');
		try {
			const queryLink = getQueryLinkJavaClass().builder()
				.relationshipModel(relationshipModelName)
				.targetRole(targetRole)
				.maxDepth(1)
				.build();

			const queryRoot = getQueryRootJavaClass().builder()
				.targetDocumentModel(docRef.documentModelName)
				.projectionName('document')
				.link(queryLink)
				.paging(getPagingJavaClass().builder().pageNumber(FIRST_PAGE).pageSize(PAGE_SIZE_LIMIT).build())
				.build();

			const queryPage: QueryPage<DocumentTreeResult> = executionContext.queryService.query(queryRoot, null);
			const content = queryPage.getContent();
			return new SimpleList(dsResultsToLinkSpecs(content, docRef, linkedDocRefs));
		} catch (error) {
			throw mapDsError(error, { operationName: 'Links.find', relationshipModelName, role: targetRole });
		}
	} else if (isWorkflowContext(executionContext)) {
		Log.info('Running in engine task context...');
		try {
			const linkResultsString = executionContext.dataServicesRpcFacade.tryListLinks(
				relationshipModelName,
				docRef.toString(),
				targetRole,
			);
			const linkResults = JSON.parse(linkResultsString);
			return new SimpleList(rpcResultsToLinkSpecs(linkResults, docRef, linkedDocRefs));
		} catch (error) {
			throw mapRpcError(error, { operationName: 'Links.find', relationshipModelName, role: targetRole });
		}
	} else if (isTestContext(executionContext)) {
		const query: Record<string, unknown> = {
			targetDocumentModel: docRef.documentModelName,
			projectionName: 'document',
			links: [{ relationshipModel: relationshipModelName, targetRole, maxDepth: 1 }],
			constraint: { operator: 'exact_match', field: '/__meta/docRef', value: docRef.toString() },
			paging: { pageNumber: FIRST_PAGE, pageSize: PAGE_SIZE_LIMIT },
		};
		const result = await callRpc(executionContext.serverConnector(), 'QUERY', { query });
		const links = Object.values(result['links'] ?? []) as DocumentTreeResultJson[];
		return new SimpleList(rpcResultsToLinkSpecs(links, docRef, linkedDocRefs));
	}

	throw new UnsupportedContextError('Links.find');
}

/**
 * Finds documents linked to a given document in a given role of a given relationship model.
 * @param relationshipModelName - The name of the relationship model.
 * @param docRef - The document reference to find linked documents for.
 * @param role - The role of the linked documents in the relationship model (QueryLink targetRole).
 * @returns Document references of the linked documents.
 *
 * @example
 * ```ts
 * const linkedDocRefList = A12.Links.getLinkedDocuments("Project_Employee_RM", projectDocRef, "Employee")
 * ```
 */
export async function getLinkedDocuments(
	relationshipModelName: RelationshipModelName,
	docRef: DocumentReference,
	role: Role,
): Promise<SimpleList<DocumentReference>> {
	const links = await find(relationshipModelName, docRef, role);
	return new SimpleList(links.toArray().map((spec) => spec.linkDescriptor.targetDocRef));
}
