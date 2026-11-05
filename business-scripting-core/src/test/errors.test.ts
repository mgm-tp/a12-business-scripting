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

import { describe, expect, it } from 'vitest';

import {
	AuthenticationError,
	BatchError,
	DocumentNotFoundError,
	LinkConstraintError,
	ModelNotFoundError,
	ScriptingError,
	UnsupportedContextError,
} from '../api/errors.js';
import { API_KEY_FILE_ENV_VAR } from '../internal/constants.js';
import { mapRpcError } from '../internal/rpc-error-mapper.js';

const DOCS_CREATE_OP = 'A12.Documents.create';
const FOO_DM_NOT_FOUND_MSG = "Model 'Foo_DM' not found.";

describe('ScriptingError hierarchy', () => {
	describe('AuthenticationError', () => {
		it('should state the reason, the environment variable and the deployment-side prerequisite', () => {
			const error = new AuthenticationError('The deployment rejected the credential.');

			expect(error.message).toContain('The deployment rejected the credential.');
			expect(error.message).toContain(API_KEY_FILE_ENV_VAR);
			expect(error.message).toContain('the deployment trusts');
			expect(error.name).toBe('AuthenticationError');
		});

		it('should be a ScriptingError so facades pass it through unmapped', () => {
			const error = new AuthenticationError('No certificate file is configured.');

			expect(error).toBeInstanceOf(ScriptingError);
			expect(mapRpcError(error)).toBe(error);
		});
	});

	describe('UnsupportedContextError', () => {
		it('should construct message from method name', () => {
			const error = new UnsupportedContextError('Documents.create');
			expect(error.message).toBe('Documents.create is not supported in the current execution context.');
			expect(error.name).toBe('UnsupportedContextError');
			expect(error).toBeInstanceOf(ScriptingError);
		});
	});

	describe('BatchError', () => {
		it('should aggregate multiple errors with 1-based indices and operation names', () => {
			const errors = [
				{ index: 1, operationName: DOCS_CREATE_OP, error: new ModelNotFoundError(FOO_DM_NOT_FOUND_MSG) },
				{ index: 3, operationName: 'A12.Documents.modify', error: new DocumentNotFoundError("Document 'Bar_DM/123' not found.") },
			];
			const batchError = new BatchError(errors);

			expect(batchError).toBeInstanceOf(ScriptingError);
			expect(batchError.name).toBe('BatchError');
			expect(batchError.errors).toHaveLength(2);
			expect(batchError.skipped).toHaveLength(0);
			expect(batchError.linkConstraintErrors).toHaveLength(0);
			expect(batchError.message).toContain('Batch operation failed');
			expect(batchError.message).toContain(`1) ${DOCS_CREATE_OP} — ModelNotFoundError: ${FOO_DM_NOT_FOUND_MSG}`);
			expect(batchError.message).toContain("3) A12.Documents.modify — DocumentNotFoundError: Document 'Bar_DM/123' not found.");
			expect(batchError.message).not.toContain('Skipped');
			expect(batchError.message).not.toContain('LinkConstraintErrors');
		});

		it('should include skipped operations at the end of message', () => {
			const errors = [
				{ index: 1, operationName: DOCS_CREATE_OP, error: new ModelNotFoundError(FOO_DM_NOT_FOUND_MSG) },
			];
			const skipped = [
				{ index: 2, operationName: 'A12.Documents.find' },
				{ index: 3, operationName: 'A12.Documents.modify' },
			];
			const batchError = new BatchError(errors, skipped);

			expect(batchError.errors).toHaveLength(1);
			expect(batchError.skipped).toHaveLength(2);
			expect(batchError.message).toContain('Batch operation failed');
			expect(batchError.message).toContain(`1) ${DOCS_CREATE_OP} — ModelNotFoundError: ${FOO_DM_NOT_FOUND_MSG}`);
			expect(batchError.message).toContain('Skipped: 2) A12.Documents.find, 3) A12.Documents.modify.');
		});

		it('should include link constraint errors before skipped', () => {
			const errors = [
				{ index: 2, operationName: 'A12.Documents.find', error: new ModelNotFoundError('Search failed.') },
			];
			const skipped = [
				{ index: 3, operationName: 'A12.Documents.modify' },
			];
			const linkConstraintErrors = [
				new LinkConstraintError('Upper limit reached.'),
			];
			const batchError = new BatchError(errors, skipped, linkConstraintErrors);

			expect(batchError.linkConstraintErrors).toHaveLength(1);
			expect(batchError.message).toContain('LinkConstraintErrors: Upper limit reached.');
			expect(batchError.message).toContain('Skipped: 3) A12.Documents.modify.');
			const constraintPos = batchError.message.indexOf('LinkConstraintErrors');
			const skippedPos = batchError.message.indexOf('Skipped');
			expect(constraintPos).toBeLessThan(skippedPos);
		});

		it('should work with a single error and no skipped operations', () => {
			const errors = [{ index: 1, operationName: DOCS_CREATE_OP, error: new ModelNotFoundError('not found') }];
			const batchError = new BatchError(errors);
			expect(batchError.message).toContain('Batch operation failed');
		});
	});
});
