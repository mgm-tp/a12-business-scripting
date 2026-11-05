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

// Sync with DataServicesRpcFacade.kt
/** @internal */
export const RPC_METHODS = {
	DOCUMENTS_CREATE: 'A12.Documents.create',
	DOCUMENTS_COPY: 'A12.Documents.copy',
	DOCUMENTS_GET: 'A12.Documents.get',
	DOCUMENTS_MODIFY: 'A12.Documents.modify',
	DOCUMENTS_REMOVE: 'A12.Documents.remove',
	DOCUMENTS_FIND: 'A12.Documents.find',
	DOCUMENTS_WRITE_FIELDS: 'A12.Documents.writeFields',
	LINKS_FIND: 'A12.Links.find',
	LINKS_CREATE: 'A12.Links.create',
	LINKS_REMOVE: 'A12.Links.remove',
} as const;

/**
 * Represents a single batch operation that can be executed as part of a batch call.
 * Created via Batch.Documents.* or Batch.Links.* functions.
 * @typeParam T - The expected return type of this operation.
 * @public
 */
export interface BatchOperation<T> {
	/** @internal Method name for RPC dispatch */
	readonly methodName: string;
	/** @internal Parameters for the RPC method */
	readonly params: Record<string, unknown>;
	/** @internal Transformation to apply to the raw result */
	readonly transformResult?: (raw: unknown) => T;
}

/**
 * Results from a batch call, allowing typed access to individual operation results.
 * @public
 */
export interface BatchResults {
	/** Gets the result of a specific operation by its reference */
	get<T>(operation: BatchOperation<T>): T;
}
