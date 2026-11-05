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
	ScriptingError,
} from '../api/errors.js';
import { isJavaThrowable } from '../graaljs-compat-typings/index.js';

import {
	businessScriptingVetoError,
	dataServicesRequestFailedError,
	documentNotFoundError,
	documentNotWrittenError,
	documentSearchError,
	documentValidationError,
	ErrorContext,
	invalidDocumentPartError,
	invalidFieldError,
	invalidLocaleError,
	linkDocumentMissingError,
	linkDocumentNotAllowedError,
	linkRoleModelMismatchError,
	linkRoleNotFoundError,
	modelNotFoundError,
	SCRIPT_FAILED_PATTERN,
	scriptExecutionError,
	scriptNotFoundError,
} from './error-builders.js';

/**
 * Attempts to get the Java class name from a GraalVM-interop exception.
 * Returns the simple class name (e.g. "NotFoundException") or undefined if unavailable.
 */
function getJavaClassName(error: unknown): string | undefined {
	if (!isJavaThrowable(error)) { return undefined; }
	try {
		const fullName = error.getClass().getName();
		return fullName.substring(fullName.lastIndexOf('.') + 1);
	} catch {
		return undefined;
	}
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) { return error.message; }
	const withMessage = error as { message?: unknown } | null;
	if (typeof withMessage?.message === 'string') { return withMessage.message; }
	if (isJavaThrowable(error)) { return error.getMessage() ?? String(error); }
	return String(error);
}

type ClassMapping = {
	className: string;
	messageTest?: (message: string) => boolean;
	map: (message: string, context: ErrorContext, cause: unknown) => ScriptingError;
};

const CLASS_MAPPINGS: ClassMapping[] = [
	{
		className: 'ScriptExecutionException',
		map: (msg, _ctx, cause) => scriptExecutionError(msg, cause),
	},
	{
		className: 'BusinessScriptExecutionVetoException',
		map: (msg, _ctx, cause) => businessScriptingVetoError(msg, cause),
	},
	{
		className: 'NotFoundException',
		messageTest: (msg) => /Document model/.test(msg) || /Relationship model/.test(msg),
		map: (msg, ctx, cause) => modelNotFoundError(ctx, msg, cause),
	},
	{
		className: 'NotFoundException',
		messageTest: (msg) => /document not found/.test(msg) || /was not found/.test(msg),
		map: (msg, ctx, cause) => documentNotFoundError(ctx, msg, cause),
	},
	{
		className: 'NotFoundException',
		messageTest: (msg) => /Script/.test(msg) || /script/.test(msg),
		map: (_msg, ctx, cause) => scriptNotFoundError(ctx, cause),
	},
	{
		className: 'DocumentValidationException',
		map: (msg, ctx, cause) => documentValidationError(ctx, msg, cause),
	},
	{
		className: 'InvalidInputException',
		map: (msg, ctx, cause) =>
			/Invalid documentPart/.test(msg) ? invalidDocumentPartError(ctx, cause) : documentNotWrittenError(ctx, cause),
	},
	{
		className: 'QueryValidationException',
		map: (_msg, ctx, cause) => invalidFieldError(ctx, cause),
	},
	{
		className: 'SearchServiceException',
		map: (_msg, ctx, cause) => documentSearchError(ctx, cause),
	},
	{
		className: 'RelationshipRoleNameNotFoundException',
		map: (msg, ctx, cause) => linkRoleNotFoundError(ctx, msg, cause),
	},
	{
		className: 'RelationshipLinkDocumentModelMismatchException',
		map: (msg, ctx, cause) => linkRoleModelMismatchError(ctx, msg, cause),
	},
	{
		className: 'RelationshipLinkDocumentMissingException',
		map: (msg, ctx, cause) => linkDocumentMissingError(ctx, msg, cause),
	},
	{
		// A link spec with a blank role or missing document; only the DELETE_LINK checks throw it
		className: 'RelationshipLinkEntityInvalidException',
		map: () => new LinkSpecIncompleteError(),
	},
	{
		// A link spec whose relationship model differs from the stored link
		className: 'RelationshipModelMismatchException',
		map: () => new LinkSpecMismatchError(),
	},
	{
		// A link spec whose roles or documents differ from the stored link
		className: 'RelationshipRoleMismatchException',
		map: () => new LinkSpecMismatchError(),
	},
	{
		className: 'IllegalArgumentException',
		messageTest: (msg) => /locale/i.test(msg) && /not supported/.test(msg),
		map: (msg, ctx, cause) => invalidLocaleError(ctx, msg, cause),
	},
	{
		className: 'NullPointerException',
		messageTest: (msg) => /documentModelId is marked non-null but is null/.test(msg),
		map: (_msg, ctx, cause) => linkDocumentNotAllowedError(ctx, cause),
	},
];

/**
 * Fallback message-only patterns for when Java class name is not available.
 */
type MessageMapping = {
	test: (message: string) => boolean;
	map: (message: string, context: ErrorContext, cause: unknown) => ScriptingError;
};

const MESSAGE_FALLBACKS: MessageMapping[] = [
	{
		// First, so that the cause a failed script reports is not classified as that cause's own error type
		test: (msg) => SCRIPT_FAILED_PATTERN.test(msg),
		map: (msg, _ctx, cause) => scriptExecutionError(msg, cause),
	},
	{
		test: (msg) => /Document model \[.*] not found/.test(msg) || /Relationship model \[.*] not found/.test(msg),
		map: (msg, ctx, cause) => modelNotFoundError(ctx, msg, cause),
	},
	{
		test: (msg) => /document not found/.test(msg) || /document \S+ was not found/.test(msg),
		map: (msg, ctx, cause) => documentNotFoundError(ctx, msg, cause),
	},
	{
		test: (msg) => /Document is not valid/.test(msg) || /validation of document/.test(msg),
		map: (msg, ctx, cause) => documentValidationError(ctx, msg, cause),
	},
	{
		test: (msg) => /path: \$\.fields/.test(msg),
		map: (_msg, ctx, cause) => invalidFieldError(ctx, cause),
	},
	{
		test: (msg) => /role .* has not been found/.test(msg),
		map: (msg, ctx, cause) => linkRoleNotFoundError(ctx, msg, cause),
	},
	{
		test: (msg) => /should have been defined for models \[.*?\], found \[.*?\] instead/.test(msg),
		map: (msg, ctx, cause) => linkRoleModelMismatchError(ctx, msg, cause),
	},
	{
		test: (msg) => /Link Model is present \[.*?\] but document is blank/.test(msg),
		map: (msg, ctx, cause) => linkDocumentMissingError(ctx, msg, cause),
	},
	{
		test: (msg) => /documentModelId is marked non-null but is null/.test(msg),
		map: (_msg, ctx, cause) => linkDocumentNotAllowedError(ctx, cause),
	},
	{
		test: (msg) => /Locale/.test(msg) && /not supported/.test(msg),
		map: (msg, ctx, cause) => invalidLocaleError(ctx, msg, cause),
	},
	{
		// Matches the exact message DataServices' CallableScriptService throws for an unknown script.
		// A looser 'script' plus 'not found' test also caught errors thrown *inside* a called script,
		// because such a message can name the failing script file, e.g.
		// "Script 'model-not-found.js' failed at model-not-found.ts:4 caused by: ... not found.".
		test: (msg) => /Callable script with name \S+ not found/.test(msg),
		map: (_msg, ctx, cause) => scriptNotFoundError(ctx, cause),
	},
];

/**
 * Maps a DS-internal Java exception to a ScriptingError subclass.
 * Tries Java class name matching first (via GraalVM interop), then falls back to message matching.
 */
export function mapDsError(error: unknown, context: ErrorContext = {}): ScriptingError {
	if (error instanceof ScriptingError) { return error; }

	const className = getJavaClassName(error);
	const message = getErrorMessage(error);

	// Strategy 1: Match by Java class name (reliable when GraalVM interop is available)
	if (className) {
		for (const mapping of CLASS_MAPPINGS) {
			if (mapping.className === className) {
				if (!mapping.messageTest || mapping.messageTest(message)) {
					return mapping.map(message, context, error);
				}
			}
		}
	}

	// Strategy 2: Fall back to message-only matching
	for (const fallback of MESSAGE_FALLBACKS) {
		if (fallback.test(message)) {
			return fallback.map(message, context, error);
		}
	}

	// Final fallback
	return dataServicesRequestFailedError(context, error);
}
