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

import { DocumentV2, isJavaThrowable, RankedNotification } from '../../../graaljs-compat-typings/index.js';
import {executionContext, isDataServicesContext, isTestContext, isWorkflowContext} from '../../execution-contexts.js';
import { DocumentDeserializationError, UnsupportedContextError } from '../../errors.js';
import { mockDocumentV2FromJson } from '../../../internal/mock-helpers.js';
import {
    getDocumentDeserializationConfigJavaClass,
    getDocumentSerializationConfigJavaClass,
    getStringReaderJavaClass
} from '../../../internal/java-classes.js';

import { A12 } from "../index.js";

/**
 * Serialization utilities for DocumentV2 conversion.
 */

/**
 * Converts a JSON string to DocumentV2.
 * @param json - The JSON string representing document data.
 * @param documentModelName - The name of the document model.
 * @returns The deserialized DocumentV2.
 * @throws {DocumentDeserializationError} if the JSON content does not match the document model.
 *
 * @example
 * ```ts
 * const document = A12.Documents.toDocumentV2('{"Project": {"Name": "A12"}}', "Project_DM")
 * ```
 */
export function toDocumentV2(json: string, documentModelName: string): DocumentV2 {
	if (isWorkflowContext(executionContext)) {
		try {
            return executionContext.dataServicesRpcFacade.jsonToDocumentV2(json, documentModelName);
		} catch (error) {
			const message = isJavaThrowable(error)
				? (error.getMessage() ?? error.toString())
				: error instanceof Error
					? error.message
					: String(error);
			throw new DocumentDeserializationError(message);
		}
	} else if (isDataServicesContext(executionContext)) {
		const StringReader = getStringReaderJavaClass();
		const reader = new StringReader(json);
		const config = getDocumentDeserializationConfigJavaClass().builder().format(getDocumentSerializationConfigJavaClass().Format.JSON).build();
		const notifications: RankedNotification[] = [];
		const document = executionContext.documentV2Serializer[
			'deserializeV2(java.io.Reader,java.lang.String,com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig,java.util.function.Consumer)'
		](reader, documentModelName, config, (n) => notifications.push(n));
		const errors = notifications.filter((n) => n.getSeverity().name() === 'ERROR');
        const warnings = notifications.filter((n) => n.getSeverity().name() === "WARNING")
        if (warnings.length > 0){
            A12.Log.warning(`[Documents.toDocumentV2] Deserialization of ${documentModelName} has warnings: ${warnings.map((e) => e.getMessage()).join('; ')}`)
        }
		if (errors.length > 0) {
			throw new DocumentDeserializationError(
				`[Documents.toDocumentV2] Deserialization of '${documentModelName}' failed: ${errors.map((e) => e.getMessage()).join('; ')}`,
			);
		}
		return document;
	} else if (isTestContext(executionContext)) {
		return mockDocumentV2FromJson(JSON.parse(json) as Record<string, unknown>, documentModelName);
	} else {
		throw new UnsupportedContextError('Documents.toDocumentV2');
	}
}
