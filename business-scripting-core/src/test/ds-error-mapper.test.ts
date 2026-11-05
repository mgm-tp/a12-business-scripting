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
	BusinessScriptingVetoError,
	DocumentDeserializationError,
	DocumentNotFoundError,
	DocumentSearchError,
	DocumentValidationError,
	InvalidDocumentPartError,
	InvalidFieldError,
	InvalidLocaleError,
	LinkDocumentError,
	LinkRoleError,
	LinkSpecIncompleteError,
	LinkSpecMismatchError,
	ScriptNotFoundError,
	ModelNotFoundError,
	ScriptExecutionError,
	ScriptingError,
} from '../api/errors.js';
import { mapDsError } from '../internal/ds-error-mapper.js';
import { mockJavaThrowable } from '../internal/mock-helpers.js';

import {
	PERSONAL_DATA_MARKER,
	SCRIPT_FAILURE_EXCEPTION_CLASS_NAME,
	VETO_EXCEPTION_CLASS_NAME,
	VETO_REASON,
} from './test-helpers.js';

const DS_PACKAGE = 'com.mgmtp.a12.dataservices';
const DOCUMENT_MODEL_NAME = 'Foo_DM';
const RELATIONSHIP_MODEL_NAME = 'Foo_RM';
const DOC_REF = 'Foo_DM/123';
const SCRIPT_NAME = 'myScript';
const NESTED_SCRIPT_NAME = 'modelNotFound';

const DOCUMENT_MODEL_CONTEXT = { documentModelName: DOCUMENT_MODEL_NAME };
const RELATIONSHIP_MODEL_CONTEXT = { relationshipModelName: RELATIONSHIP_MODEL_NAME };
const DOC_REF_CONTEXT = { docRef: DOC_REF };


/** Simulates a plain JS Error (when GraalVM interop is not available). */
function jsError(message: string) {
	return new Error(message);
}

describe('mapDsError', () => {
	describe('class-name-based matching (GraalVM interop available)', () => {
		it.each([
			{
				scenario: 'NotFoundException → ModelNotFoundError for document model',
				className: 'NotFoundException',
				dsMessage: `Document model [${DOCUMENT_MODEL_NAME}] not found`,
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: ModelNotFoundError,
				expectedMessage: `Model '${DOCUMENT_MODEL_NAME}' not found.`,
			},
			{
				scenario: 'NotFoundException → ModelNotFoundError for relationship model',
				className: 'NotFoundException',
				dsMessage: `Relationship model [${RELATIONSHIP_MODEL_NAME}] not found`,
				context: RELATIONSHIP_MODEL_CONTEXT,
				expectedErrorType: ModelNotFoundError,
				expectedMessage: `Relationship model '${RELATIONSHIP_MODEL_NAME}' not found.`,
			},
			{
				scenario: 'NotFoundException → DocumentNotFoundError',
				className: 'NotFoundException',
				dsMessage: `Partial modify document failed, document not found for [docRef = ${DOC_REF}]`,
				context: DOC_REF_CONTEXT,
				expectedErrorType: DocumentNotFoundError,
				expectedMessage: `Document '${DOC_REF}' not found.`,
			},
			{
				scenario: 'NotFoundException → ScriptNotFoundError',
				className: 'NotFoundException',
				dsMessage: `Script '${SCRIPT_NAME}' not found`,
				context: { scriptName: SCRIPT_NAME },
				expectedErrorType: ScriptNotFoundError,
				expectedMessage: `Script '${SCRIPT_NAME}' not found.`,
			},
			{
				scenario: 'DocumentValidationException → DocumentValidationError',
				className: 'DocumentValidationException',
				dsMessage: 'Document is not valid: [Entity: Person ...]',
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: DocumentValidationError,
				expectedMessageContains: `Document validation failed for model '${DOCUMENT_MODEL_NAME}'`,
			},
			{
				scenario: 'SearchServiceException → DocumentSearchError',
				className: 'SearchServiceException',
				dsMessage: `Unable to perform search [docModelName=${DOCUMENT_MODEL_NAME}]`,
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: DocumentSearchError,
			},
			{
				scenario: 'RelationshipRoleNameNotFoundException → LinkRoleError',
				className: 'RelationshipRoleNameNotFoundException',
				dsMessage: `Requested role [BadRole] has not been found in the model [${RELATIONSHIP_MODEL_NAME}].`,
				context: RELATIONSHIP_MODEL_CONTEXT,
				expectedErrorType: LinkRoleError,
			},
			{
				scenario: 'RelationshipLinkDocumentModelMismatchException → LinkRoleError',
				className: 'RelationshipLinkDocumentModelMismatchException',
				dsMessage: `Document [Bar_DM/1] should have been defined for models [${DOCUMENT_MODEL_NAME}], found [Bar_DM] instead`,
				context: RELATIONSHIP_MODEL_CONTEXT,
				expectedErrorType: LinkRoleError,
			},
			{
				scenario: 'QueryValidationException → InvalidFieldError',
				className: 'QueryValidationException',
				dsMessage: 'Field /Project/Bla not found',
				context: { documentModelName: DOCUMENT_MODEL_NAME, operationName: 'Documents.find' },
				expectedErrorType: InvalidFieldError,
				expectedMessage: `A field is not valid for model '${DOCUMENT_MODEL_NAME}'.`,
			},
			{
				scenario: 'RelationshipLinkDocumentMissingException → LinkDocumentError',
				className: 'RelationshipLinkDocumentMissingException',
				dsMessage: 'Link Model is present [LinkDM] but document is blank.',
				context: RELATIONSHIP_MODEL_CONTEXT,
				expectedErrorType: LinkDocumentError,
				expectedMessage: `Link document missing but defined for relationship model '${RELATIONSHIP_MODEL_NAME}': Link Model is present [LinkDM] but document is blank.`,
			},
			{
				scenario: 'RelationshipLinkEntityInvalidException → LinkSpecIncompleteError',
				className: 'RelationshipLinkEntityInvalidException',
				dsMessage: 'One of the entities has no valid role.',
				expectedErrorType: LinkSpecIncompleteError,
				expectedMessage: new LinkSpecIncompleteError().message,
			},
			{
				scenario: 'RelationshipModelMismatchException → LinkSpecMismatchError',
				className: 'RelationshipModelMismatchException',
				dsMessage: `Requested link [link-1] is for relationship model [Bar_RM], but expected is [${RELATIONSHIP_MODEL_NAME}]`,
				expectedErrorType: LinkSpecMismatchError,
				expectedMessage: new LinkSpecMismatchError().message,
			},
			{
				scenario: 'RelationshipRoleMismatchException → LinkSpecMismatchError',
				className: 'RelationshipRoleMismatchException',
				dsMessage: `Requested link [link-1] has role:docRef [Bar:${DOC_REF}], but expected is [Foo:${DOC_REF}]`,
				expectedErrorType: LinkSpecMismatchError,
				expectedMessage: new LinkSpecMismatchError().message,
			},
			{
				scenario: 'IllegalArgumentException with locale message → InvalidLocaleError',
				className: 'IllegalArgumentException',
				dsMessage: "The locale 'xx' is not supported (supported locales: 'yy', 'zz').",
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: InvalidLocaleError,
			},
			{
				scenario: 'IllegalArgumentException with unmatched message → ScriptingError',
				className: 'IllegalArgumentException',
				dsMessage: 'Some other argument error',
				expectedErrorType: ScriptingError,
			},
		])('should map $scenario', ({ className, dsMessage, context, expectedErrorType, expectedMessage, expectedMessageContains }) => {
			const error = mapDsError(mockJavaThrowable(`${DS_PACKAGE}.${className}`, dsMessage), context);

			expect(error).toBeInstanceOf(expectedErrorType);
			if (expectedMessage) {expect(error.message).toBe(expectedMessage);}
			if (expectedMessageContains) {expect(error.message).toContain(expectedMessageContains);}
		});
	});

	describe('message-only fallback (no GraalVM interop)', () => {
		it.each([
			{
				scenario: 'document model not found',
				dsMessage: `Document model [${DOCUMENT_MODEL_NAME}] not found`,
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: ModelNotFoundError,
			},
			{
				scenario: 'document not found',
				dsMessage: `Partial modify document failed, document not found for [docRef = ${DOC_REF}]`,
				context: DOC_REF_CONTEXT,
				expectedErrorType: DocumentNotFoundError,
			},
			{
				scenario: 'validation error',
				dsMessage: 'Document is not valid: [Entity: Person ...]',
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: DocumentValidationError,
			},
		])('should map $scenario by message', ({ dsMessage, context, expectedErrorType }) => {
			const error = mapDsError(jsError(dsMessage), context);

			expect(error).toBeInstanceOf(expectedErrorType);
		});

		it('should map a field error by message', () => {
			// given
			const original = jsError('- path: $.fields\n  message: |\n    Field /Project/Bla not found.\n');

			// when
			const error = mapDsError(original, DOCUMENT_MODEL_CONTEXT);

			// then
			expect(error).toBeInstanceOf(InvalidFieldError);
			expect(error.message).toBe(`A field is not valid for model '${DOCUMENT_MODEL_NAME}'.`);
			expect(error.cause).toBe(original);
		});

		it('should map a missing callable script by message', () => {
			const error = mapDsError(
				jsError(`Callable script with name ${SCRIPT_NAME} not found`),
				{ operationName: 'Scripts.call', scriptName: SCRIPT_NAME },
			);

			expect(error).toBeInstanceOf(ScriptNotFoundError);
			expect(error.message).toBe(`Script '${SCRIPT_NAME}' not found.`);
		});

		// Regression test for false ScriptNotFound matching
		it('should keep the inner error of a failed nested script call instead of reporting it as a missing script', () => {
			// The message names the failing script file and a cause that is 'not found', which a looser
			// test read as "the script does not exist".
			const errorMessage =
				"Script 'model-not-found.js' failed at model-not-found.ts:4 caused by: ModelNotFoundError: Model 'NonExistent_DM' not found.";

			const error = mapDsError(
				jsError(errorMessage),
				{ operationName: 'Scripts.call', scriptName: NESTED_SCRIPT_NAME },
			);

			expect(error).not.toBeInstanceOf(ScriptNotFoundError);
			expect(error.message).toBe(errorMessage);
		});

		it('should keep the reason of a vetoed nested script call', () => {
			// given
			const original = mockJavaThrowable(VETO_EXCEPTION_CLASS_NAME, VETO_REASON);

			// when
			const error = mapDsError(original, { operationName: 'Scripts.call', scriptName: NESTED_SCRIPT_NAME });

			// then
			expect(error).toBeInstanceOf(BusinessScriptingVetoError);
			expect(error.message).toBe(VETO_REASON);
			expect(error.cause).toBe(original);
		});

		it('should keep the already sanitized message of a failed nested script call', () => {
			// given
			const errorMessage = "Script 'model-not-found.js' failed caused by: ModelNotFoundError: Model 'NonExistent_DM' not found.";
			const original = mockJavaThrowable(SCRIPT_FAILURE_EXCEPTION_CLASS_NAME, errorMessage);

			// when
			const error = mapDsError(original, { operationName: 'Scripts.call', scriptName: NESTED_SCRIPT_NAME });

			// then
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error.message).toBe(errorMessage);
		});
	});

	describe('already-mapped ScriptingError pass-through', () => {
		it('should return a ScriptingError subclass unchanged without re-wrapping', () => {
			const original = new DocumentDeserializationError("Deserialization of 'Project_DM' failed: unknown field");
			const result = mapDsError(original, { operationName: 'Documents.create', documentModelName: 'Project_DM' });
			expect(result).toBe(original);
		});
	});

	describe('final fallback', () => {
		it('should produce base ScriptingError for completely unknown errors', () => {
			const error = mapDsError(jsError('Something completely unexpected'));
			expect(error).toBeInstanceOf(ScriptingError);
			expect(error.constructor).toBe(ScriptingError);
			expect(error.message).toBe('Data Services request failed.');
		});

		it('should include operation name in fallback', () => {
			const error = mapDsError(jsError('unknown'), { operationName: 'Documents.create' });
			expect(error.message).toContain('[Documents.create]');
		});

		it('should preserve original error as cause in fallback', () => {
			const original = jsError('original');
			const error = mapDsError(original);
			expect(error.cause).toBe(original);
		});
	});

	describe('Data Services text that may quote personal data', () => {
		it.each([
			{
				scenario: 'invalid document part',
				className: 'InvalidInputException',
				dsMessage: `Invalid documentPart [value=${PERSONAL_DATA_MARKER}]`,
				context: DOC_REF_CONTEXT,
				expectedErrorType: InvalidDocumentPartError,
				expectedMessage: `Could not write document '${DOC_REF}' - invalid document part`,
			},
			{
				scenario: 'other invalid input',
				className: 'InvalidInputException',
				dsMessage: `Invalid input [value=${PERSONAL_DATA_MARKER}]`,
				context: DOC_REF_CONTEXT,
				expectedErrorType: ScriptingError,
				expectedMessage: `Could not write document '${DOC_REF}'`,
			},
			{
				scenario: 'other invalid input of a write operation',
				className: 'InvalidInputException',
				dsMessage: `Invalid input [value=${PERSONAL_DATA_MARKER}]`,
				context: { docRef: DOC_REF, operationName: 'Documents.writeFields' },
				expectedErrorType: ScriptingError,
				expectedMessage: `Could not write document '${DOC_REF}' - potentially invalid document part`,
			},
			{
				scenario: 'other invalid input without a document reference',
				className: 'InvalidInputException',
				dsMessage: `Invalid input [value=${PERSONAL_DATA_MARKER}]`,
				context: { operationName: 'Documents.create' },
				expectedErrorType: ScriptingError,
				expectedMessage: 'Could not write document',
			},
			{
				scenario: 'SearchServiceException',
				className: 'SearchServiceException',
				dsMessage: `Unable to perform search [value=${PERSONAL_DATA_MARKER}]`,
				context: DOCUMENT_MODEL_CONTEXT,
				expectedErrorType: DocumentSearchError,
				expectedMessage: `Search failed for model '${DOCUMENT_MODEL_NAME}'.`,
			},
			{
				scenario: 'unrecognized exception',
				className: 'IllegalStateException',
				dsMessage: `Unexpected failure for ${PERSONAL_DATA_MARKER}`,
				context: { operationName: 'Documents.create' },
				expectedErrorType: ScriptingError,
				expectedMessage: '[Documents.create] Data Services request failed.',
			},
		])('should keep the $scenario text out of the message and keep it as the cause', ({ className, dsMessage, context, expectedErrorType, expectedMessage }) => {
			// given
			const original = mockJavaThrowable(`${DS_PACKAGE}.${className}`, dsMessage);

			// when
			const error = mapDsError(original, context);

			// then
			expect(error).toBeInstanceOf(expectedErrorType);
			expect(error.message).toBe(expectedMessage);
			expect(error.cause).toBe(original);
		});

	});
});
