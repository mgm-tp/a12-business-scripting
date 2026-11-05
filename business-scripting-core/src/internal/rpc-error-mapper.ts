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

import {
	LinkSpecIncompleteError,
	LinkSpecMismatchError,
	RpcError as RpcCallError,
	ScriptingError,
} from '../api/errors.js';

import {
	dataServicesRequestFailedError,
	documentModelNotFoundError,
	documentNotFoundError,
	documentNotWrittenError,
	documentSearchError,
	documentValidationError,
	ErrorContext,
	invalidDocumentPartError,
	invalidFieldError,
	invalidLocaleError,
	linkConstraintError,
	linkDocumentMissingError,
	linkDocumentNotAllowedError,
	linkRoleModelMismatchError,
	linkRoleNotFoundError,
	relationshipModelNotFoundError,
	SCRIPT_FAILED_PATTERN,
	scriptExecutionError,
	scriptNotFoundError,
} from './error-builders.js';

/**
 * Shape of the error field in a JSON-RPC 2.0 error response from Data Services.
 */
export interface RpcError {
	message?: string;
	data?: {
		title?: { default?: string };
		description?: { default?: string };
	};
}

/** `cause` is the original RPC error. */
type PatternEntry = {
	test: (description: string, title: string) => boolean;
	map: (description: string, title: string, context: ErrorContext, cause: unknown) => ScriptingError;
};

/**
 * Names the script that failed, preferring the identity the RPC error carries: where a script failed
 * because it called another script, that identity names the called script and the line it failed at.
 */
function describeFailedScript(title: string, context: ErrorContext): string {
	if (SCRIPT_FAILED_PATTERN.test(title)) { return title; }
	if (context.scriptName) { return `Script '${context.scriptName}' failed`; }
	return 'Script execution failed';
}

const PATTERNS: PatternEntry[] = [
	// The two script entries come first because a failed script reports its own cause in the
	// description. That cause text can be any A12 error, which would otherwise be classified by the
	// description-based entries below and hide the fact that a called script failed.
	{
		// CALL_SCRIPT names the failing script in the title and what made it fail in the description.
		// Keeping the title makes each nesting level of a script call visible as its own 'caused by' link.
		test: (desc, title) => SCRIPT_FAILED_PATTERN.test(title) || SCRIPT_FAILED_PATTERN.test(desc),
		map: (desc, title, ctx, cause) => scriptExecutionError(describeFailedScript(title, ctx), cause, desc || 'unknown error'),
	},
	{
		test: (desc, title) =>
			/Could not find script/.test(title) ||
			/Could not find script/.test(desc) ||
			/error\.business-scripting\.script\.notFound/.test(title),
		map: (_desc, _title, ctx, cause) => scriptNotFoundError(ctx, cause),
	},
	{
		test: (desc) => /Document model .+ not found/.test(desc),
		map: (desc, _title, ctx, cause) => documentModelNotFoundError(ctx, desc, cause),
	},
	{
		test: (desc) => /Relationship model .+ not found/.test(desc),
		map: (desc, _title, ctx, cause) => relationshipModelNotFoundError(ctx, desc, cause),
	},
	{
		test: (desc) => /Document \[.*] was not found/.test(desc) || /document not found/.test(desc),
		map: (desc, _title, ctx, cause) => documentNotFoundError(ctx, desc, cause),
	},
	{
		test: (desc) => /validation of document/.test(desc) || /Document is not valid/.test(desc),
		map: (desc, _title, ctx, cause) => documentValidationError(ctx, desc, cause),
	},
	{
		test: (desc) => /locale '.*' is not supported/i.test(desc),
		map: (desc, _title, ctx, cause) => invalidLocaleError(ctx, desc, cause),
	},
	{
		test: (desc, title) => /Unable to perform search/.test(desc) || /Unable to perform search/.test(title),
		map: (_desc, _title, ctx, cause) => documentSearchError(ctx, cause),
	},
	{
		test: (desc) => /path: \$\.targetDocumentModel/.test(desc),
		map: (desc, _title, ctx, cause) => documentModelNotFoundError(ctx, desc, cause),
	},
	{
		test: (desc) => /path: \$\.fields/.test(desc),
		map: (_desc, _title, ctx, cause) => invalidFieldError(ctx, cause),
	},
	{
		test: (desc) => /role \[.*?\] has not been found/.test(desc),
		map: (desc, _title, ctx, cause) => linkRoleNotFoundError(ctx, desc, cause),
	},
	{
		test: (desc) => /should have been defined for models/.test(desc),
		map: (desc, _title, ctx, cause) => linkRoleModelMismatchError(ctx, desc, cause),
	},
	{
		test: (desc) => /Link Model is present \[.*?\] but document is blank/.test(desc),
		map: (desc, _title, ctx, cause) => linkDocumentMissingError(ctx, desc, cause),
	},
	{
		test: (desc, title) =>
			/documentModelId is marked non-null but is null/.test(desc) ||
			/documentModelId is marked non-null but is null/.test(title),
		map: (_desc, _title, ctx, cause) => linkDocumentNotAllowedError(ctx, cause),
	},
	{
		test: (desc, title) =>
			/Upper [Ll]imit [Rr]eached/.test(desc) ||
			/Upper [Ll]imit [Rr]eached/.test(title) ||
			/Duplicated link constraint violated/.test(desc) ||
			/Duplicated link constraint violated/.test(title),
		map: (desc, title, ctx, cause) => linkConstraintError(ctx, desc || title, cause),
	},
	{
		// DELETE_LINK: "Wrong Relationship Model" and "Wrong Entity" for a spec that does not match the stored link
		test: (desc) => /Requested link \[[^\]]*] (is for relationship model|has role:docRef)/.test(desc),
		map: () => new LinkSpecMismatchError(),
	},
	{
		// DELETE_LINK: "Invalid Link Entity Role" for a spec with a blank role or missing document
		test: (desc, title) => /One of the entities has no valid role/.test(desc) || /Invalid Link Entity Role/.test(title),
		map: () => new LinkSpecIncompleteError(),
	},
	{
		test: (desc) => /Invalid documentPart/.test(desc),
		map: (_desc, _title, ctx, cause) => invalidDocumentPartError(ctx, cause),
	},
	{
		test: (desc) => !desc,
		map: (_desc, _title, ctx, cause) => documentNotWrittenError(ctx, cause),
	},
];


/**
 * Extracts description and title from a stringified JsonRpc2ResponseError in an exception message.
 * The Kotlin RPC facade throws RuntimeException("OP failed: ${response.error}") where response.error
 * is a JsonRpc2ResponseError whose toString() embeds the structured fields as a string.
 */
function extractFromStringifiedRpcError(message: string): { description: string; title: string } | undefined {
	const descMatch = /"description":\{[^}]*"default":"([^"]*)"/.exec(message);
	const titleMatch = /"title":\{[^}]*"default":"([^"]*)"/.exec(message);
	if (descMatch || titleMatch) {
		return {
			description: descMatch?.[1] ?? '',
			title: titleMatch?.[1] ?? '',
		};
	}
	return undefined;
}

/**
 * Maps an RPC error object to a ScriptingError subclass.
 * Handles two input shapes:
 * 1. Structured RPC error object (from batch results): { message, data: { title, description } }
 * 2. Thrown Error with stringified JsonRpc2ResponseError in message (from single RPC operations)
 * An RpcError from TestContext is mapped like shape 2 and returned unchanged when no pattern matches;
 * other unrecognized errors fall back to base ScriptingError.
 */
export function mapRpcError(rpcError: unknown, context: ErrorContext = {}): ScriptingError {
	// TestContext's callRpc throws RpcCallError, which carries the raw RPC error and still needs mapping
	if (rpcError instanceof ScriptingError && !(rpcError instanceof RpcCallError)) { return rpcError; }

	const error = rpcError as RpcError | undefined;
	let description = error?.data?.description?.default ?? '';
	let title = error?.data?.title?.default ?? '';

	// If no structured fields found, try to extract from stringified error message
	if (!description && !title) {
		const errorMessage = (rpcError instanceof Error ? rpcError.message : undefined)
			?? (error?.message)
			?? String(rpcError);
		const extracted = extractFromStringifiedRpcError(errorMessage);
		if (extracted) {
			description = extracted.description;
			title = extracted.title;
		}
	}

	if (rpcError instanceof RpcCallError && !description && !title) { return rpcError; }

	for (const pattern of PATTERNS) {
		if (pattern.test(description, title)) {
			return pattern.map(description, title, context, rpcError);
		}
	}

	if (rpcError instanceof RpcCallError) { return rpcError; }

	return dataServicesRequestFailedError(context, rpcError);
}
