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

import { API_KEY_FILE_ENV_VAR } from '../internal/constants.js';

/**
 * Base error class for all Business Scripting API errors.
 * Subclass names serve as error identifiers in log output (e.g. `ModelNotFoundError: ...`).
 * @public
 */
export class ScriptingError extends Error {
	override readonly cause?: unknown;

	constructor(message: string, options?: { cause?: unknown }) {
		super(message);
		this.name = this.constructor.name;
		if (options?.cause !== undefined) {
			this.cause = options.cause;
		}
	}
}

/** A document model or relationship model was not found. */
export class ModelNotFoundError extends ScriptingError {}

/** A document with the given reference was not found. */
export class DocumentNotFoundError extends ScriptingError {}

/** Document validation failed (type coercion, validation rules). */
export class DocumentValidationError extends ScriptingError {}

/** JSON content does not match the named document model during deserialization. */
export class DocumentDeserializationError extends ScriptingError {}

/** Invalid field path or repetition mismatch in a document modify operation. */
export class InvalidDocumentPartError extends ScriptingError {}

/** A document search (find) operation failed. */
export class DocumentSearchError extends ScriptingError {}

/** A field passed to an operation, e.g. in a search filter, is not valid for the document model. */
export class InvalidFieldError extends ScriptingError {}

/** A relationship role was not found or a document model does not match the role. */
export class LinkRoleError extends ScriptingError {}

/** A link document is missing or does not match the expected model. */
export class LinkDocumentError extends ScriptingError {}

/** A link constraint was violated (upper limit reached, duplicate link). */
export class LinkConstraintError extends ScriptingError {}

/** A link spec passed to remove is missing a role name or document reference. */
export class LinkSpecIncompleteError extends ScriptingError {
	constructor() {
		super('Link spec is incomplete: a role name or document reference is missing.');
	}
}

/** A link spec passed to remove differs from the stored link in its relationship model, roles or documents. */
export class LinkSpecMismatchError extends ScriptingError {
	constructor() {
		super('Link spec does not match the stored link: relationship model, roles or documents differ.');
	}
}

/** A locale is not supported for the given document model. */
export class InvalidLocaleError extends ScriptingError {}

/** An API method was called in an unsupported execution context. */
export class UnsupportedContextError extends ScriptingError {
	constructor(methodName: string) {
		super(`${methodName} is not supported in the current execution context.`);
	}
}

/**
 * The test framework could not authenticate: its certificate credential is missing, unreadable, or was
 * rejected by the deployment.
 * @public
 */
export class AuthenticationError extends ScriptingError {
	constructor(reason: string) {
		super(`${reason} Check that ${API_KEY_FILE_ENV_VAR} names a certificate the deployment trusts.`);
	}
}

/** An error occurred during the execution of an RPC call **/
export class RpcError extends ScriptingError {
    constructor(message: string, options?: { cause?: unknown }) {
        super("[RPC] " + message, options);
    }
}

/** A script with the given name was not found. */
export class ScriptNotFoundError extends ScriptingError {}

/** A script execution failed. */
export class ScriptExecutionError extends ScriptingError {}

/** An execution listener of the project vetoed running a called script. The message is the listener's reason. */
export class BusinessScriptingVetoError extends ScriptingError {}

/**
 * One or more batch operations failed.
 * @public
 */
export class BatchError extends ScriptingError {
	readonly errors: ReadonlyArray<{ index: number; operationName: string; error: ScriptingError }>;
	readonly linkConstraintErrors: ReadonlyArray<ScriptingError>;
	readonly skipped: ReadonlyArray<{ index: number; operationName: string }>;

	constructor(
		errors: Array<{ index: number; operationName: string; error: ScriptingError }>,
		skipped: Array<{ index: number; operationName: string }> = [],
		linkConstraintErrors: ScriptingError[] = [],
	) {
		const failedSummary = errors
			.map((e) => `${e.index}) ${e.operationName} — ${e.error.name}: ${e.error.message}`)
			.join(' ');
		const constraintSummary = linkConstraintErrors.length > 0
			? ` LinkConstraintErrors: ${linkConstraintErrors.map((e) => e.message).join(', ')}.`
			: '';
		const skippedSummary = skipped.length > 0
			? ` Skipped: ${skipped.map((s) => `${s.index}) ${s.operationName}`).join(', ')}.`
			: '';
		super(`Batch operation failed: ${failedSummary}.${constraintSummary}${skippedSummary}`);
		this.errors = errors;
		this.linkConstraintErrors = linkConstraintErrors;
		this.skipped = skipped;
	}
}
