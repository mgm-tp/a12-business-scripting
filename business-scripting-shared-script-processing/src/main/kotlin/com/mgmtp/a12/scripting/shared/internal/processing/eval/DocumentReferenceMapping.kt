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

package com.mgmtp.a12.scripting.shared.internal.processing.eval

import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import com.mgmtp.a12.scripting.shared.api.stringFieldOrNull
import org.graalvm.polyglot.Value

private const val DOCUMENT_MODEL_NAME = "documentModelName"
private const val DOCUMENT_ID = "documentId"

val documentReferenceScriptTypeMapping = ScriptTypeMapping(
    typeName = "DocumentReference",
    targetType = DocumentReference::class.java,
    parseInput = ::documentReferenceFromExecutionContextValue,
    parseOutput = ::documentReferenceFromScriptValue,
)

/** Workflows deliver a reference as a string, RPC callers as a map, and JVM callers as the type itself. */
private fun documentReferenceFromExecutionContextValue(raw: Any): DocumentReference? = when (raw) {
    is DocumentReference -> raw
    is String -> parseDocumentReference(raw)
    is Map<*, *> -> parseDocumentReference(raw.stringFieldOrNull(DOCUMENT_MODEL_NAME), raw.stringFieldOrNull(DOCUMENT_ID))
    else -> null
}

private fun documentReferenceFromScriptValue(value: Value): DocumentReference? = when {
    value.isString -> parseDocumentReference(value.asString())
    else -> parseDocumentReference(value.stringFieldOrNull(DOCUMENT_MODEL_NAME), value.stringFieldOrNull(DOCUMENT_ID))
}

private fun parseDocumentReference(documentModelName: String?, documentId: String?): DocumentReference? {
    if (documentModelName == null || documentId == null) return null
    return parseDocumentReference("$documentModelName/$documentId")
}

/** DocumentReference validates the format itself, rejecting it by an exception that quotes the value. */
private fun parseDocumentReference(raw: String): DocumentReference? = runCatching { DocumentReference(raw) }.getOrNull()
