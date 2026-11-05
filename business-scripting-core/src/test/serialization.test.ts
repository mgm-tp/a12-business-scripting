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

import { vi, beforeEach, expect, describe, it } from 'vitest';

import { DocumentDeserializationError } from '../api/errors.js';
import { toDocumentV2 } from '../api/facades/documents/serialization.js';

import { mockDocumentV2, mockFieldInstanceV2 } from './test-helpers.js';

const DOCUMENT_MODEL_NAME = 'Project_DM';
const MOCK_JSON = '{"Project": {"Name": "Test project", "Description": "Test description"}}';
const SIMPLE_REPETITIONS = [1, 1];
const ERROR_SEVERITY = 'ERROR';
const WARNING_SEVERITY = 'WARNING';

const mockDeserializeSpy = vi.hoisted(() => vi.fn());
const { mockGraalJsBarrelWithJavaClasses } = await vi.hoisted(() => import('./graaljs-barrel-mock.js'));

vi.mock('../api/execution-contexts.js', () => ({
	executionContext: {
		documentService: {},
		queryService: {},
        documentV2Serializer: {
			'deserializeV2(java.io.Reader,java.lang.String,com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig,java.util.function.Consumer)':
				mockDeserializeSpy,
		},
		relationshipLinkService: {},
		kernelDocumentService: {},
		scriptCaller: {},
		params: {},
	},
	isDataServicesContext: () => true,
	isWorkflowContext: () => false,
}));

vi.mock('../graaljs-compat-typings/index.js', mockGraalJsBarrelWithJavaClasses({
	'java.io.StringReader': class StringReader { constructor(public json: string) {} },
	'com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig': {
		builder: () => ({ format: () => ({ build: () => ({}) }) }),
	},
	'com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig': {
		Format: { JSON: 'JSON' },
	},
}));

const mockDoc = mockDocumentV2([
	mockFieldInstanceV2('/Project/Name', 'Test project', SIMPLE_REPETITIONS),
	mockFieldInstanceV2('/Project/Description', 'Test description', SIMPLE_REPETITIONS),
], DOCUMENT_MODEL_NAME);

function mockNotification(severity: string, message: string) {
	return {
		getSeverity: () => ({ name: () => severity }),
		getMessage: () => message,
	};
}

describe('toDocumentV2', () => {
	beforeEach(() => {
		mockDeserializeSpy.mockReset();
		mockDeserializeSpy.mockImplementation(() => mockDoc);
	});

	describe('when Kernel reports ERROR notifications', () => {
		it.each([
			{ description: 'error type', expectedError: DocumentDeserializationError, errorMessage: 'field mismatch' },
			{ description: 'Kernel error text in message', expectedError: 'field mismatch', errorMessage: 'field mismatch' },
			{ description: 'document model name in message', expectedError: DOCUMENT_MODEL_NAME, errorMessage: 'some error' },
		])('should throw with correct message ($description)', ({ expectedError, errorMessage }) => {
			// given
			mockDeserializeSpy.mockImplementation((_reader, _modelId, _config, consumer) => {
				consumer(mockNotification(ERROR_SEVERITY, errorMessage));
				return mockDoc;
			});

			// when / then
			expect(() => toDocumentV2(MOCK_JSON, DOCUMENT_MODEL_NAME)).toThrow(expectedError);
		});

		it('should throw with only ERROR messages when mixed with WARNING notifications', () => {
			// given
			mockDeserializeSpy.mockImplementation((_reader, _modelId, _config, consumer) => {
				consumer(mockNotification(WARNING_SEVERITY, 'some warning'));
				consumer(mockNotification(ERROR_SEVERITY, 'field mismatch'));
				return mockDoc;
			});

			const call = () => toDocumentV2(MOCK_JSON, DOCUMENT_MODEL_NAME);

			// when / then
			expect(call).toThrow('field mismatch');
			expect(call).not.toThrow('some warning');
		});

		it('should concatenate multiple ERROR messages with semicolons', () => {
			// given
			mockDeserializeSpy.mockImplementation((_reader, _modelId, _config, consumer) => {
				consumer(mockNotification(ERROR_SEVERITY, 'first error'));
				consumer(mockNotification(ERROR_SEVERITY, 'second error'));
				return mockDoc;
			});

			// when / then
			expect(() => toDocumentV2(MOCK_JSON, DOCUMENT_MODEL_NAME)).toThrow('first error; second error');
		});
	});

	it('should return DocumentV2 when Kernel reports no notifications', () => {
		expect(toDocumentV2(MOCK_JSON, DOCUMENT_MODEL_NAME)).toBe(mockDoc);
	});

	it('should return DocumentV2 when Kernel reports only WARNING notifications', () => {
		// given
		mockDeserializeSpy.mockImplementation((_reader, _modelId, _config, consumer) => {
			consumer(mockNotification(WARNING_SEVERITY, 'some warning'));
			return mockDoc;
		});

		// when
		const result = toDocumentV2(MOCK_JSON, DOCUMENT_MODEL_NAME);

		// then
		expect(result).toBe(mockDoc);
	});
});
