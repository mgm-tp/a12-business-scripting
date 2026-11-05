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
	BusinessScriptingVetoError,
	DocumentNotFoundError,
	DocumentSearchError,
	DocumentValidationError,
	InvalidDocumentPartError,
	InvalidFieldError,
	InvalidLocaleError,
	LinkConstraintError,
	LinkDocumentError,
	LinkRoleError,
	ModelNotFoundError,
	ScriptExecutionError,
	ScriptingError,
	ScriptNotFoundError,
} from '../api/errors.js';

/**
 * Builds the errors whose message the Data Services and RPC error mappers derive from the call-site
 * context or the Data Services text. Each builder passes the original error on as the cause.
 *
 * `dataServicesText` is the Data Services error text. Builders take it only where that text is
 * structural (model, role, locale or link names, validation hints) and never quotes data;
 * everywhere else the message is built from the context alone, because the text may quote personal data.
 */

/** Context from the API call site, used to enrich error messages. */
export interface ErrorContext {
	operationName?: string;
	documentModelName?: string;
	docRef?: string;
	relationshipModelName?: string;
	role?: string;
	scriptName?: string;
}

/** Recognizes the message a called script's failure carries, already sanitized where that script ran. */
export const SCRIPT_FAILED_PATTERN = /Script '.*' failed/;

/**
 * Links a failed script to what made it fail. Each nesting level of a script call contributes one
 * `caused by` link, so the chain stays readable.
 * @param failedScript - Names the script that failed, e.g. `Script 'x' failed`, or the whole chain a
 *   called script reported, already sanitized where that script ran.
 * @param cause - The technical reason with details
 * @param causeDescription - The sanitized textual explanation, omitted when `failedScript` already carries it
 */
export function scriptExecutionError(failedScript: string, cause: unknown, causeDescription?: string): ScriptExecutionError {
	const message = causeDescription === undefined ? failedScript : `${failedScript} caused by: ${causeDescription}`;
	return new ScriptExecutionError(message, { cause });
}

/** The reason is written by the project's own execution listener, so it is passed on as it is. */
export function businessScriptingVetoError(vetoReason: string, cause: unknown): BusinessScriptingVetoError {
	return new BusinessScriptingVetoError(vetoReason, { cause });
}

export function scriptNotFoundError(context: ErrorContext, cause: unknown): ScriptNotFoundError {
	return new ScriptNotFoundError(context.scriptName ? `Script '${context.scriptName}' not found.` : 'Script not found.', { cause });
}

export function documentModelNotFoundError(context: ErrorContext, dataServicesText: string, cause: unknown): ModelNotFoundError {
	return new ModelNotFoundError(
		context.documentModelName ? `Model '${context.documentModelName}' not found.` : dataServicesText,
		{ cause },
	);
}

export function relationshipModelNotFoundError(context: ErrorContext, dataServicesText: string, cause: unknown): ModelNotFoundError {
	return new ModelNotFoundError(
		context.relationshipModelName ? `Relationship model '${context.relationshipModelName}' not found.` : dataServicesText,
		{ cause },
	);
}

/** For a failure that does not say which kind of model is missing: names whichever the call site knows. */
export function modelNotFoundError(context: ErrorContext, dataServicesText: string, cause: unknown): ModelNotFoundError {
	return context.documentModelName
		? documentModelNotFoundError(context, dataServicesText, cause)
		: relationshipModelNotFoundError(context, dataServicesText, cause);
}

export function documentNotFoundError(context: ErrorContext, dataServicesText: string, cause: unknown): DocumentNotFoundError {
	return new DocumentNotFoundError(context.docRef ? `Document '${context.docRef}' not found.` : dataServicesText, { cause });
}

export function documentValidationError(context: ErrorContext, dataServicesText: string, cause: unknown): DocumentValidationError {
	const ref = context.docRef ? ` (${context.docRef})` : '';
	return new DocumentValidationError(
		context.documentModelName
			? `Document validation failed for model '${context.documentModelName}'${ref}: ${dataServicesText}`
			: `Document validation failed${ref}: ${dataServicesText}`,
		{ cause },
	);
}

export function invalidLocaleError(context: ErrorContext, dataServicesText: string, cause: unknown): InvalidLocaleError {
	return new InvalidLocaleError(
		context.documentModelName
			? `${dataServicesText.replace(/\.$/, '')} in document model '${context.documentModelName}'.`
			: dataServicesText,
		{ cause },
	);
}

export function documentSearchError(context: ErrorContext, cause: unknown): DocumentSearchError {
	return new DocumentSearchError(
		context.documentModelName ? `Search failed for model '${context.documentModelName}'.` : 'Search failed.',
		{ cause },
	);
}

export function invalidFieldError(context: ErrorContext, cause: unknown): InvalidFieldError {
	return new InvalidFieldError(
		context.documentModelName ? `A field is not valid for model '${context.documentModelName}'.` : 'A field is not valid.',
		{ cause },
	);
}

export function invalidDocumentPartError(context: ErrorContext, cause: unknown): InvalidDocumentPartError {
	return new InvalidDocumentPartError(
		context.docRef
			? `Could not write document '${context.docRef}' - invalid document part`
			: 'Could not write document - invalid document part',
		{ cause },
	);
}

export function documentNotWrittenError(context: ErrorContext, cause: unknown): ScriptingError {
	const document = context.docRef ? ` '${context.docRef}'` : '';
	const hint = context.operationName?.includes('Documents.write') ? ' - potentially invalid document part' : '';
	return new ScriptingError(`Could not write document${document}${hint}`, { cause });
}

export function linkRoleNotFoundError(context: ErrorContext, dataServicesText: string, cause: unknown): LinkRoleError {
	return new LinkRoleError(
		context.relationshipModelName
			? `Role not found in relationship model '${context.relationshipModelName}': ${dataServicesText}`
			: dataServicesText,
		{ cause },
	);
}

export function linkRoleModelMismatchError(context: ErrorContext, dataServicesText: string, cause: unknown): LinkRoleError {
	return new LinkRoleError(
		context.relationshipModelName
			? `Document model mismatch for role in '${context.relationshipModelName}': ${dataServicesText}`
			: dataServicesText,
		{ cause },
	);
}

export function linkDocumentMissingError(context: ErrorContext, dataServicesText: string, cause: unknown): LinkDocumentError {
	return new LinkDocumentError(
		context.relationshipModelName
			? `Link document missing but defined for relationship model '${context.relationshipModelName}': ${dataServicesText}`
			: dataServicesText,
		{ cause },
	);
}

export function linkDocumentNotAllowedError(context: ErrorContext, cause: unknown): LinkDocumentError {
	return new LinkDocumentError(
		context.relationshipModelName
			? `No Link document allowed for relationship model '${context.relationshipModelName}'`
			: 'No Link document allowed',
		{ cause },
	);
}

export function linkConstraintError(context: ErrorContext, dataServicesText: string, cause: unknown): LinkConstraintError {
	return new LinkConstraintError(
		context.relationshipModelName
			? `Link constraint violated for relationship model '${context.relationshipModelName}': ${dataServicesText}`
			: dataServicesText,
		{ cause },
	);
}

export function dataServicesRequestFailedError(context: ErrorContext, cause: unknown): ScriptingError {
	const prefix = context.operationName ? `[${context.operationName}] ` : '';
	return new ScriptingError(`${prefix}Data Services request failed.`, { cause });
}
