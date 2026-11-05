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

import { executionContext, isTestContext, isWorkflowContext } from '../../execution-contexts.js';
import { BatchError, ScriptingError, UnsupportedContextError } from '../../errors.js';
import { mapRpcError, RpcError } from '../../../internal/rpc-error-mapper.js';

import * as Log from '../logging.js';

import { BatchOperation, BatchResults } from './batch-api.js';

type RpcErrorResult = { error: RpcError };

function isRpcError(result: unknown): result is RpcErrorResult {
	return result != null && typeof result === 'object' && (result as { error?: unknown }).error != null;
}

function isCascadingError(result: unknown): boolean {
	if (!isRpcError(result)) { return false; }
	const error = result.error;
	const message = error.message ?? error.data?.description?.default ?? String(error);
	return /[Pp]revious operation failed/.test(message);
}

/**
 * Executes multiple batch operations in a single RPC call.
 * Batch operations execute sequentially in order they are passed - consider this when passing several operations on the same document.
 * If any operations fail, a BatchError is thrown containing all failures.
 * @param operations - The operations to execute (created via Batch.Documents.* or Batch.Links.* - inline or separately).
 * @returns BatchResults object for retrieving typed results.
 *
 * @example
 * ```ts
 * const createDoc = A12.Batch.Documents.create("Project_DM")
 * const createLink = A12.Batch.Links.create(linkDescriptor)
 *
 * const results = A12.Batch.call(createDoc, createLink)
 *
 * const docRef = results.get(createDoc)
 * const linkId = results.get(createLink)
 * ```
 */
export function call(...operations: BatchOperation<unknown>[]): BatchResults {
	if (operations.length === 0) {
		Log.warning('[Batch.call] No operations provided for batch call');
		return createEmptyResults();
	}

	if (isWorkflowContext(executionContext)) {
		const batch = operations.map((op) => ({
			method: op.methodName,
			params: op.params,
		}));

		const rawResults = executionContext.dataServicesRpcFacade.batchCall(batch);

		const collectedErrors: Array<{ index: number; operationName: string; error: ScriptingError }> = [];
		const skippedOperations: Array<{ index: number; operationName: string }> = [];
		const linkConstraintErrors: ScriptingError[] = [];
		const resultMap = new Map<BatchOperation<unknown>, unknown>();

		// Process 1:1 mapped results
		for (let i = 0; i < operations.length; i++) {
			const op = operations[i]!;
			const rawResult = rawResults[i];

			if (isCascadingError(rawResult)) {
				skippedOperations.push({ index: i + 1, operationName: op.methodName });
			} else if (isRpcError(rawResult)) {
				const mappedError = mapRpcError(rawResult.error, {
					operationName: op.methodName,
				});
				collectedErrors.push({ index: i + 1, operationName: op.methodName, error: mappedError });
			} else {
				const transformedResult = op.transformResult ? op.transformResult(rawResult) : rawResult;
				resultMap.set(op, transformedResult);
			}
		}

        // Process additional errors from deferred link validation
		for (let i = operations.length; i < rawResults.length; i++) {
			const rawResult = rawResults[i];
			if (isRpcError(rawResult)) {
				linkConstraintErrors.push(mapRpcError(rawResult.error));
			}
		}

		if (collectedErrors.length > 0 || linkConstraintErrors.length > 0) {
			throw new BatchError(collectedErrors, skippedOperations, linkConstraintErrors);
		}

		return {
			get<T>(operation: BatchOperation<T>): T {
				if (!resultMap.has(operation)) {
					throw new ScriptingError('[Batch.call] Operation not found in results. Was it part of this batch?');
				}
				return resultMap.get(operation) as T;
			},
		};
	} else if (isTestContext(executionContext)) {
		// Return mock results for testing
		const resultMap = new Map<BatchOperation<unknown>, unknown>();
		for (const op of operations) {
			resultMap.set(op, `mock result for ${op.methodName}`);
		}

		return {
			get<T>(operation: BatchOperation<T>): T {
				if (!resultMap.has(operation)) {
					throw new ScriptingError('[Batch.call] Operation not found in results. Was it part of this batch?');
				}
				return resultMap.get(operation) as T;
			},
		};
	} else {
		throw new UnsupportedContextError('Batch.call');
	}
}

function createEmptyResults(): BatchResults {
	return {
		get<T>(): T {
			throw new ScriptingError('[Batch.call] No operations were executed.');
		},
	};
}
