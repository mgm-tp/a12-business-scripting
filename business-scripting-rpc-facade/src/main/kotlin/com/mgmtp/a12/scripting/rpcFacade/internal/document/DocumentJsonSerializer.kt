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

package com.mgmtp.a12.scripting.rpcFacade.internal.document

import com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig
import com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig
import com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2
import com.mgmtp.a12.kernel.md.document.apiV2.services.IDocumentV2Serializer
import com.mgmtp.a12.model.notification.RankedNotification
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.io.StringReader
import java.io.StringWriter

/**
 * Handles serialization and deserialization of A12 documents to/from JSON.
 */
class DocumentJsonSerializer(
    private val documentV2Serializer: IDocumentV2Serializer,
    private val objectMapper: ObjectMapper,
) {

    /**
     * Serializes DocumentV2 to JSON string.
     */
    fun documentV2ToJson(document: DocumentV2): String {
        val writer = StringWriter()
        val config =
            DocumentSerializationConfig
                .builder()
                .format(DocumentSerializationConfig.Format.JSON)
                .build()
        documentV2Serializer.serializeV2(document, writer, config)
        return writer.toString()
    }

    /**
     * Deserializes JSON to DocumentV2 (for future migration).
     */
    fun jsonToDocumentV2(
        json: String,
        documentModelId: String,
    ): DocumentV2 {
        val config =
            DocumentDeserializationConfig
                .builder()
                .format(DocumentSerializationConfig.Format.JSON)
                .build()
        val notifications = mutableListOf<RankedNotification>()
        val documentV2 = documentV2Serializer.deserializeV2(StringReader(json), documentModelId, config) { notifications.add(it) }
        handleSerializationErrorsAndWarnings(documentModelId, notifications)
        return documentV2
    }

    /**
     * Converts JSON string to ObjectNode, removing documentModelId field.
     */
    fun toJsonNodeWithoutModelId(json: String): ObjectNode {
        val node = objectMapper.readTree(json) as ObjectNode
        node.remove("documentModelId")
        return node
    }

    /**
     * Converts any document input (DocumentV2, JSON string, Map) to JsonNode, or null for null input.
     */
    fun toJsonNode(document: Any?) = document?.let { objectMapper.readTree(toJsonString(it)) }

    /**
     * Converts any document input (DocumentV2, JSON string, Map) to JSON string.
     */
    fun toJsonString(document: Any?): String = when (document) {
        null -> "{}"
        is DocumentV2 -> documentV2ToJson(document)
        is String -> document
        is Map<*, *> -> objectMapper.writeValueAsString(document)
        else -> objectMapper.writeValueAsString(document)
    }

    private fun handleSerializationErrorsAndWarnings(
        documentModelId: String,
        notifications: List<RankedNotification>,
    ) {
        val warnings = notifications.filter { it.severity.name == "WARNING" }
        if (warnings.isNotEmpty()) {
            logger().warn("Deserialization of '$documentModelId' has warnings: ${warnings.joinToString("; ") { it.message }}")
        }
        val errors = notifications.filter { it.severity.name == "ERROR" }
        if (errors.isNotEmpty()) {
            throw IllegalStateException(
                "Deserialization of '$documentModelId' failed: ${errors.joinToString("; ") { it.message }}",
            )
        }
    }
}
