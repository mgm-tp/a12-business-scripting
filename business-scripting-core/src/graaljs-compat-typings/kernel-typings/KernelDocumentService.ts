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

import { JavaOptional } from '../java-util-typings/Optional.js';
import { Locale } from '../java-util-typings/Locale.js';

import { DocumentV2 } from './DocumentV2.js';

/**
 * Validation result from Kernel document validation.
 * @see com.mgmtp.a12.kernel.md.rt.api.IDocumentValidationResult
 */
export interface IDocumentValidationResult {
	/** @returns true if no ERROR-severity messages were found (warnings and infos are not considered) */
	noErrorOccurred(): boolean;
	/** @returns all errors, warnings, and infos found; empty if there were none */
	getMessages(): IMessage[];
}

/**
 * A single validation message from Kernel.
 * @see com.mgmtp.a12.kernel.md.rt.api.IMessage
 */
export interface IMessage {
	/** Detailed error message text with all parameters already substituted */
	getErrorText(): string;
	/** Error code as defined in the validation rule */
	getErrorCode(): string;
	/** Whether it is a value error or an omission error */
	getMessageType(): { name(): 'OMISSION_ERROR' | 'VALUE_ERROR' };
	/** Whether it is an error, warning, or info */
	getSeverity(): { name(): 'ERROR' | 'WARNING' | 'INFO' };
	/** Path to the rule that triggered this message, or empty if it is a formal error */
	getRulePath(): JavaOptional<string>;
	/** Pointer to the field that caused the error */
	getErrorFieldPointer(): unknown;
	/** Field pointers that may have caused the error */
	getReferencedFieldsPointers(): unknown[];
	/** Field pointers responsible for generating omission errors */
	getRefOmissionErrorResponsiblePointers(): unknown[];
}

/**
 * Configuration for document processing (validation and computation).
 * @see com.mgmtp.a12.kernel.md.rt.api.DocumentProcessingConfig
 */
export interface DocumentProcessingConfig {
	/** Locale used for validation error messages */
	languageOfErrorMessages(): Locale;
	customConditionFactory(): unknown;
	customFieldTypeFactory(): unknown;
	/** If set, the rule language construct "Today" evaluates to this date instead of the actual date */
	currentDateForTest(): unknown;
	/** Creates a builder for DocumentProcessingConfig with the given locale */
	builder(validationLanguage: Locale): DocumentProcessingConfigBuilder;
}

/**
 * Builder for DocumentProcessingConfig.
 * @see com.mgmtp.a12.kernel.md.rt.api.DocumentProcessingConfigBuilder
 */
export interface DocumentProcessingConfigBuilder {
	build(): DocumentProcessingConfig;
}

/**
 * Result of a document computation.
 * @see com.mgmtp.a12.kernel.md.rt.api.IDocumentComputationResult
 */
export type IDocumentComputationResult = object;

/**
 * Kernel Document Service for validation and computation operations.
 * @see com.mgmtp.a12.kernel.md.rt.api.IDocumentRtService
 */
export interface KernelDocumentService {
	/**
	 * Validates the whole document.
	 * @param document - The document to validate
	 * @param config - Processing config including the locale for error messages
	 * @returns Validation result with messages
	 */
	validateFull(document: DocumentV2, config: DocumentProcessingConfig): IDocumentValidationResult;

	/**
	 * Validates a part of the document (only the relevant entities).
	 * @param document - The document to validate
	 * @param relevantEntities - The set of entity instances relevant for validation
	 * @param config - Processing config including the locale for error messages
	 * @returns Validation result with messages
	 */
	validatePart(document: DocumentV2, relevantEntities: unknown, config: DocumentProcessingConfig): IDocumentValidationResult;

	/**
	 * Computes all computable fields in the document.
	 * @param document - The document to compute
	 * @param config - Processing config including the locale for error messages
	 * @returns Computation result with computed field instances
	 */
	compute(document: DocumentV2, config: DocumentProcessingConfig): IDocumentComputationResult;
}
