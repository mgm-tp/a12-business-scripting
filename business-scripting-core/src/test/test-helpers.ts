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

import { expect } from 'vitest';

import { FieldSpec } from '../api/types.js';

// Re-export mocks from mock-helpers for test convenience
export {
	mockJavaOptional,
	mockJavaSet,
	mockFieldSpec,
	mockFieldInstanceV2,
	mockGroupInstanceV2,
	mockDocumentV2,
	mockLinkSpec,
} from '../internal/mock-helpers.js';

/** Authorization header value handed to `TestContext.init` wherever a test sets up a context. */
export const TEST_AUTHORIZATION_HEADER = 'APIKey dGVzdC1jZXJ0aWZpY2F0ZQ==';

/** Stands for a document field value or other personal data that Data Services may quote in its error text. */
export const PERSONAL_DATA_MARKER = 'Jane Doe';

/** Java class of the exception a project's execution listener throws to veto a script call. */
export const VETO_EXCEPTION_CLASS_NAME = 'com.mgmtp.a12.scripting.shared.api.exceptions.BusinessScriptExecutionVetoException';

/** Veto reason as written by a project's own execution listener. */
export const VETO_REASON = 'Unauthorized: missing required token';

/** Java class of the exception a failed nested script call arrives as. */
export const SCRIPT_FAILURE_EXCEPTION_CLASS_NAME = 'com.mgmtp.a12.scripting.shared.api.exceptions.ScriptExecutionException';

// Test-specific utilities
export function expectFieldSpecProps(
	field: FieldSpec,
	expectedPath: string,
	expectedValue: unknown,
	expectedRepetitions: number[],
): void {
	expect(field.path).toBe(expectedPath);
	expect(field.value).toBe(expectedValue);
	expect(field.repetitions).toEqual(expectedRepetitions);
}
