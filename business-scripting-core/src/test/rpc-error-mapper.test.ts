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

import {describe, expect, it} from 'vitest';

import {
    AuthenticationError,
    DocumentNotFoundError,
    DocumentSearchError,
    DocumentValidationError,
    InvalidDocumentPartError,
    InvalidFieldError,
    InvalidLocaleError,
    LinkConstraintError,
    LinkDocumentError,
    LinkRoleError,
    LinkSpecIncompleteError,
    LinkSpecMismatchError,
    RpcError,
    ModelNotFoundError,
    ScriptExecutionError,
    ScriptingError,
    ScriptNotFoundError,
} from '../api/errors.js';
import {mapRpcError} from '../internal/rpc-error-mapper.js';

import {PERSONAL_DATA_MARKER} from './test-helpers.js';

const RPC_ROLLBACK_TITLE = 'JSON-RPC Request failed and rollback was performed';
const DOCUMENT_MODEL_NAME = 'Foo_DM';
const RELATIONSHIP_MODEL_NAME = 'Foo_RM';
const DOC_REF = 'Foo_DM/123';
const LINK_ID = 'link-1';
const SCRIPT_NAME = 'myScript';
const SCRIPT_NOT_FOUND_MSG = `Script '${SCRIPT_NAME}' not found.`;
// The titles CALL_SCRIPT reports, which name the failing script file rather than the caller's name for it
const SCRIPT_FAILED_TITLE = "Script 'someScript.js' failed";
const SCRIPT_FAILED_AT_LINE_TITLE = "Script 'someScript.js' failed at some-script.ts:6";
const DOCUMENT_NOT_FOUND_CAUSE = 'DocumentNotFoundError: Document not found.';

function rpcError(title: string, description: string | null, message?: string) {
	return {
		message: message ?? title,
		data: {
			title: { default: title },
			description: description !== null ? { default: description } : undefined,
		},
	};
}

describe('mapRpcError', () => {
	describe('ModelNotFoundError', () => {
		it('should map non-existent document model', () => {
			const error = mapRpcError(
				rpcError(
					RPC_ROLLBACK_TITLE,
					'Document model [Nonexistent_DM] not found',
				),
				{ documentModelName: 'Nonexistent_DM' },
			);
			expect(error).toBeInstanceOf(ModelNotFoundError);
			expect(error.message).toBe("Model 'Nonexistent_DM' not found.");
		});

		it('should map targetDocumentModel JSON schema validation error', () => {
			const error = mapRpcError(
				rpcError(
					RPC_ROLLBACK_TITLE,
					'- path: $.targetDocumentModel\n  message: |\n    Document model [Nonexistent_DM] not found.\n',
				),
				{ documentModelName: 'Nonexistent_DM' },
			);
			expect(error).toBeInstanceOf(ModelNotFoundError);
			expect(error.message).toBe("Model 'Nonexistent_DM' not found.");
		});

		it('should map non-existent relationship model', () => {
			const error = mapRpcError(
				rpcError(
					RPC_ROLLBACK_TITLE,
					"Relationship model 'Nonexistent_RM' not found",
				),
				{ relationshipModelName: 'Nonexistent_RM' },
			);
			expect(error).toBeInstanceOf(ModelNotFoundError);
			expect(error.message).toBe("Relationship model 'Nonexistent_RM' not found.");
		});
	});

	describe('DocumentNotFoundError', () => {
		it('should map non-existent document', () => {
			const error = mapRpcError(
				rpcError(`Document [${DOC_REF}] was not found`, `Document [${DOC_REF}] was not found`),
				{ docRef: DOC_REF },
			);
			expect(error).toBeInstanceOf(DocumentNotFoundError);
			expect(error.message).toBe(`Document '${DOC_REF}' not found.`);
		});
	});

	describe('DocumentValidationError', () => {
		it('should map validation of document failure', () => {
			const error = mapRpcError(
				rpcError(
					RPC_ROLLBACK_TITLE,
					`The validation of document of document model '${DOCUMENT_MODEL_NAME}' failed. Error while converting the value...`,
				),
				{ documentModelName: DOCUMENT_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(DocumentValidationError);
			expect(error.message).toContain(`Document validation failed for model '${DOCUMENT_MODEL_NAME}'`);
		});

		it('should map Document is not valid', () => {
			const error = mapRpcError(
				rpcError(
					'Could not create document',
					"Document is not valid [Entity: 'Person' Type: VALUE_ERROR Message: 'Name is required']",
				),
				{ documentModelName: DOCUMENT_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(DocumentValidationError);
			// The validation message is a hint about the field, written by the modeler
			expect(error.message).toContain('Name is required');
		});
	});

	describe('InvalidLocaleError', () => {
		it('should map unsupported locale', () => {
			const error = mapRpcError(
				rpcError(
                    'Could not create document',
                    "The locale 'xx' is not supported (supported locales: 'yy', 'zz').",
				),
				{ documentModelName: DOCUMENT_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(InvalidLocaleError);
			expect(error.message).toContain("locale 'xx'");
		});
	});

	describe('DocumentSearchError', () => {
		it('should map search failure', () => {
			const error = mapRpcError(
				rpcError(
					`Unable to perform search [docModelName=${DOCUMENT_MODEL_NAME}]`,
					`Unable to perform search [docModelName=${DOCUMENT_MODEL_NAME}]`,
				),
				{ documentModelName: DOCUMENT_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(DocumentSearchError);
			expect(error.message).toContain(`Search failed for model '${DOCUMENT_MODEL_NAME}'`);
		});

	});

	describe('InvalidFieldError', () => {
		it.each([
			{ operationName: 'Documents.find' },
			{ operationName: 'Documents.create' },
		])('should map a field validation error of $operationName to InvalidFieldError', ({ operationName }) => {
			const error = mapRpcError(
				rpcError(
					'Constraint validation error',
					'- path: $.fields\n  message: |\n    Field /Project/Bla not found.\n',
				),
				{ documentModelName: DOCUMENT_MODEL_NAME, operationName },
			);
			expect(error).toBeInstanceOf(InvalidFieldError);
			expect(error.message).toBe(`A field is not valid for model '${DOCUMENT_MODEL_NAME}'.`);
		});
	});

	describe('LinkSpecMismatchError and LinkSpecIncompleteError', () => {
		it.each([
			['Wrong Relationship Model', `Requested link [${LINK_ID}] is for relationship model [${RELATIONSHIP_MODEL_NAME}]`],
			['Wrong Entity', `Requested link [${LINK_ID}] has role:docRef [Employee:${DOC_REF}]`],
		])('should map DELETE_LINK "%s"', (title, description) => {
			const error = mapRpcError(rpcError(title, description), { relationshipModelName: RELATIONSHIP_MODEL_NAME });
			expect(error).toBeInstanceOf(LinkSpecMismatchError);
			expect(error.message).not.toContain(LINK_ID);
		});

		it('should map DELETE_LINK "Invalid Link Entity Role" to an incomplete link spec', () => {
			const error = mapRpcError(rpcError('Invalid Link Entity Role', 'One of the entities has no valid role!'));
			expect(error).toBeInstanceOf(LinkSpecIncompleteError);
		});
	});

	describe('RpcError thrown by TestContext', () => {
		it('should map the RPC error it carries', () => {
			// given
			const testContextError = new RpcError(
				'DELETE_LINK returned error: {"code":-32015,"message":"Wrong Entity","data":{"description":' +
				`{"default":"Requested link [${LINK_ID}] has role:docRef [Employee:${DOC_REF}]"}}}`,
			);

			// when / then
			expect(mapRpcError(testContextError)).toBeInstanceOf(LinkSpecMismatchError);
		});

		it('should return the RpcError itself when no pattern matches', () => {
			// given
			const testContextError = new RpcError('Login failed: 401 Unauthorized');

			// when / then
			expect(mapRpcError(testContextError)).toBe(testContextError);
		});
	});

	describe('LinkRoleError', () => {
		it('should map non-existent role', () => {
			const error = mapRpcError(
				rpcError(
					'Missing Role in Model',
					`The role [BadRole] has not been found in the model '${RELATIONSHIP_MODEL_NAME}'`,
				),
				{ relationshipModelName: RELATIONSHIP_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(LinkRoleError);
		});

		it('should map document model mismatch for role', () => {
			const error = mapRpcError(
				rpcError(
					'Bad Document Model',
					`Document 'Bar_DM/1' should have been defined for models '${DOCUMENT_MODEL_NAME}', found 'Bar_DM' instead`,
				),
				{ relationshipModelName: RELATIONSHIP_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(LinkRoleError);
		});
	});

	describe('LinkDocumentError', () => {
		it('should map missing link document', () => {
			const error = mapRpcError(
				rpcError('Missing Link Model', "Link Model is present [LinkDM] but document is blank"),
				{ relationshipModelName: RELATIONSHIP_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(LinkDocumentError);
		});

		it('should map "documentModelId is marked non-null but is null" to LinkDocumentError for Links.create', () => {
			const error = mapRpcError(
				rpcError(
					RPC_ROLLBACK_TITLE,
					'documentModelId is marked non-null but is null',
				),
				{ operationName: 'Links.create', relationshipModelName: RELATIONSHIP_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(LinkDocumentError);
			expect(error.message).toContain(`No Link document allowed for relationship model '${RELATIONSHIP_MODEL_NAME}'`);
		});
	});

	describe('LinkConstraintError', () => {
		it('should map upper limit reached', () => {
			const error = mapRpcError(
				rpcError(
					'Upper Limit Reached',
					`Upper limit reached for role 'Employee' in relationship model '${RELATIONSHIP_MODEL_NAME}'.`,
				),
				{ relationshipModelName: RELATIONSHIP_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(LinkConstraintError);
			expect(error.message).toContain('Link constraint violated');
		});

		it('should map duplicate link constraint', () => {
			const error = mapRpcError(
				rpcError(
					'Duplicated link constraint violated',
					`Creation of the link of model '${RELATIONSHIP_MODEL_NAME}' between [doc1] and [doc2] violates duplication constraint`,
				),
				{ relationshipModelName: RELATIONSHIP_MODEL_NAME },
			);
			expect(error).toBeInstanceOf(LinkConstraintError);
		});
	});

	describe('ScriptNotFoundError', () => {
		it('should map script not found via RPC exception key in title', () => {
			const error = mapRpcError(
				rpcError(
					'error.business-scripting.script.notFound',
					'error.business-scripting.script.notFound',
				),
				{ scriptName: SCRIPT_NAME },
			);
			expect(error).toBeInstanceOf(ScriptNotFoundError);
			expect(error.message).toBe(SCRIPT_NOT_FOUND_MSG);
		});

		it('should map script not found via human-readable description', () => {
			const error = mapRpcError(
				rpcError(
					`Could not find script with name ${SCRIPT_NAME}`,
					`Could not find script with name ${SCRIPT_NAME}`,
				),
				{ scriptName: SCRIPT_NAME },
			);
			expect(error).toBeInstanceOf(ScriptNotFoundError);
			expect(error.message).toBe(SCRIPT_NOT_FOUND_MSG);
		});
	});

	describe('ScriptExecutionError', () => {
		it('should keep the failing script and its line from the title', () => {
			const error = mapRpcError(
				rpcError(SCRIPT_FAILED_AT_LINE_TITLE, DOCUMENT_NOT_FOUND_CAUSE),
				{ scriptName: SCRIPT_NAME },
			);
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error.message).toBe(`${SCRIPT_FAILED_AT_LINE_TITLE} caused by: ${DOCUMENT_NOT_FOUND_CAUSE}`);
		});

		it('should name the script alone when the deployment hides source locations', () => {
			const error = mapRpcError(
				rpcError(SCRIPT_FAILED_TITLE, DOCUMENT_NOT_FOUND_CAUSE),
				{ scriptName: SCRIPT_NAME },
			);
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error.message).toBe(`${SCRIPT_FAILED_TITLE} caused by: ${DOCUMENT_NOT_FOUND_CAUSE}`);
		});

		it('should show one caused-by link per nesting level of a script call', () => {
			const nestedCause = `ScriptExecutionError: Script 'price-lookup.js' failed at price-lookup.ts:9 `
				+ `caused by: ${DOCUMENT_NOT_FOUND_CAUSE}`;
			const error = mapRpcError(
				rpcError(SCRIPT_FAILED_AT_LINE_TITLE, nestedCause),
				{ scriptName: SCRIPT_NAME },
			);
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error.message).toBe(`${SCRIPT_FAILED_AT_LINE_TITLE} caused by: ${nestedCause}`);
		});

		it('should not let the cause of a failed script be classified as that cause\'s own error type', () => {
			const error = mapRpcError(
				rpcError(SCRIPT_FAILED_AT_LINE_TITLE, `Document [${DOC_REF}] was not found`),
				{ scriptName: SCRIPT_NAME, docRef: DOC_REF },
			);
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error).not.toBeInstanceOf(DocumentNotFoundError);
		});

		it('should name the script the caller addressed when the title carries no script identity', () => {
			const error = mapRpcError(
				rpcError(RPC_ROLLBACK_TITLE, `Script 'someScript.js' failed caused by: ${DOCUMENT_NOT_FOUND_CAUSE}`),
				{ scriptName: SCRIPT_NAME },
			);
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error.message).toBe(
				`Script '${SCRIPT_NAME}' failed caused by: Script 'someScript.js' failed caused by: ${DOCUMENT_NOT_FOUND_CAUSE}`,
			);
		});

		it('should map a script failure from a stringified RPC error', () => {
			const stringified = new Error(
				`CALL_SCRIPT failed: JsonRpc2ResponseError(data={"title":{"default":"${SCRIPT_FAILED_TITLE}"},`
				+ `"description":{"default":"${DOCUMENT_NOT_FOUND_CAUSE}"}})`,
			);
			const error = mapRpcError(stringified, { scriptName: SCRIPT_NAME });
			expect(error).toBeInstanceOf(ScriptExecutionError);
			expect(error.message).toBe(`${SCRIPT_FAILED_TITLE} caused by: ${DOCUMENT_NOT_FOUND_CAUSE}`);
		});
	});

	describe('document not written', () => {
		it.each([
			{
				scenario: 'a write operation, with the document part hint',
				context: { docRef: DOC_REF, operationName: 'Documents.writeFields' },
				expectedMessage: `Could not write document '${DOC_REF}' - potentially invalid document part`,
			},
			{
				scenario: 'another operation, without the hint',
				context: { docRef: DOC_REF, operationName: 'Documents.modify' },
				expectedMessage: `Could not write document '${DOC_REF}'`,
			},
			{
				scenario: 'a call site without a document reference',
				context: { operationName: 'Documents.create' },
				expectedMessage: 'Could not write document',
			},
		])('should name $scenario for an error without description and keep it as the cause', ({ context, expectedMessage }) => {
			// given
			const original = rpcError(RPC_ROLLBACK_TITLE, null);

			// when
			const error = mapRpcError(original, context);

			// then
			expect(error).toBeInstanceOf(ScriptingError);
			expect(error.message).toBe(expectedMessage);
			expect(error.cause).toBe(original);
		});
	});

	describe('already-mapped ScriptingError pass-through', () => {
		it('should return a ScriptingError subclass unchanged without re-wrapping', () => {
			const original = new DocumentNotFoundError("Document 'Foo_DM/1' not found.");
			const result = mapRpcError(original, { operationName: 'Documents.get', docRef: 'Foo_DM/1' });
			expect(result).toBe(original);
		});

		// Every API operation reports RPC failures through this mapper, so passing the error through here is
		// what makes a rejected credential surface as an authentication failure on all of them.
		it('should return an AuthenticationError unchanged', () => {
			const rejected = new AuthenticationError('The deployment rejected the credential.');
			const result = mapRpcError(rejected, { operationName: 'Documents.get', docRef: 'Foo_DM/1' });
			expect(result).toBe(rejected);
		});
	});

	describe('fallback', () => {
		it('should fall back to base ScriptingError for unrecognized patterns', () => {
			const error = mapRpcError(
				rpcError('Something unexpected', 'Some unknown error detail'),
			);
			expect(error).toBeInstanceOf(ScriptingError);
			expect(error.constructor).toBe(ScriptingError);
			expect(error.message).toBe('Data Services request failed.');
		});

		it('should include operation name in fallback message', () => {
			const error = mapRpcError(
				rpcError('Unknown', 'Unknown detail'),
				{ operationName: 'Documents.create' },
			);
			expect(error.message).toContain('[Documents.create]');
		});
	});

	describe('Data Services text that may quote personal data', () => {
		it.each([
			{
				scenario: 'search failure',
				description: `Unable to perform search [value=${PERSONAL_DATA_MARKER}]`,
				context: { documentModelName: DOCUMENT_MODEL_NAME },
				expectedErrorType: DocumentSearchError,
				expectedMessage: `Search failed for model '${DOCUMENT_MODEL_NAME}'.`,
			},
			{
				scenario: 'invalid document part',
				description: `Invalid documentPart [value=${PERSONAL_DATA_MARKER}]`,
				context: { docRef: DOC_REF },
				expectedErrorType: InvalidDocumentPartError,
				expectedMessage: `Could not write document '${DOC_REF}' - invalid document part`,
			},
			{
				scenario: 'unrecognized error',
				description: `Unexpected failure for ${PERSONAL_DATA_MARKER}`,
				context: { operationName: 'Documents.create' },
				expectedErrorType: ScriptingError,
				expectedMessage: '[Documents.create] Data Services request failed.',
			},
		])('should keep the $scenario text out of the message and keep it as the cause', ({ description, context, expectedErrorType, expectedMessage }) => {
			// given
			const original = rpcError(RPC_ROLLBACK_TITLE, description);

			// when
			const error = mapRpcError(original, context);

			// then
			expect(error).toBeInstanceOf(expectedErrorType);
			expect(error.message).toBe(expectedMessage);
			expect(error.cause).toBe(original);
		});
	});
});
