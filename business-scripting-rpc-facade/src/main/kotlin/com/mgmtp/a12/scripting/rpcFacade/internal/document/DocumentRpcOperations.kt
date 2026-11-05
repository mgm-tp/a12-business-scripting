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

import com.mgmtp.a12.dataservices.client.rpc.RequestBuilderFactory
import com.mgmtp.a12.dataservices.client.rpc.RpcOperationsClient
import com.mgmtp.a12.dataservices.document.DocumentPart
import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.dataservices.document.operation.CoreOperationConstants
import com.mgmtp.a12.dataservices.query.DirectFieldOrder
import com.mgmtp.a12.dataservices.query.Paging
import com.mgmtp.a12.dataservices.query.topology.QueryRoot
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2
import com.mgmtp.a12.scripting.rpcFacade.internal.JsonRpcRequestParams
import com.mgmtp.a12.scripting.rpcFacade.internal.query.QueryConstants
import com.mgmtp.a12.scripting.rpcFacade.internal.query.buildConstraintOperator
import tools.jackson.databind.JsonNode
import java.util.*

/**
 * RPC operations for A12 Documents.
 */
class DocumentRpcOperations(
    private val rpcClient: RpcOperationsClient,
    private val requestBuilderFactory: RequestBuilderFactory,
    private val serializer: DocumentJsonSerializer,
) {
    /**
     * Creates a new document.
     * @param docModelName Document model name
     * @param document Optional initial document (DocumentV2, JSON string, or Map)
     * @param locale Optional locale for validation
     * @return The created document's reference
     */
    fun tryAdd(
        docModelName: String,
        document: Any? = null,
        locale: Locale? = null,
    ): DocumentReference {
        val json = serializer.toJsonString(document)
        val response = invokeAdd(docModelName, serializer.toJsonNodeWithoutModelId(json), locale)
        val result = extractResultOrThrow(response, "ADD_DOCUMENT")
        val docRef = result
            .get("docRef")
            .stringValue()
        return DocumentReference(docRef)
    }

    /**
     * Copies a document.
     * @param docRefString Document reference as string
     * @param locale Optional locale for validation
     * @return The new document reference as string
     */
    fun tryCopy(
        docRefString: String,
        locale: Locale? = null,
    ): String {
        val docRef = DocumentReference(docRefString)
        val response = invokeCopy(docRef, locale)
        val result = extractResultOrThrow(response, "COPY_DOCUMENT")
        return result
            .get("docRef")
            .stringValue()
    }

    /**
     * Modifies a document completely using an DocumentV2.
     */
    fun tryModify(
        docRefString: String,
        document: DocumentV2,
        locale: Locale? = null,
    ) {
        val docRef = DocumentReference(docRefString)
        val jsonNode = serializer.toJsonNodeWithoutModelId(serializer.documentV2ToJson(document))
        extractResultOrThrow(invokeModify(docRef, jsonNode, locale), "MODIFY_DOCUMENT")
    }

    /**
     * Modifies a document completely using JSON.
     */
    fun tryModifyFromJson(
        docRefString: String,
        json: String,
        locale: Locale? = null,
    ) {
        val docRef = DocumentReference(docRefString)
        val jsonNode = serializer.toJsonNodeWithoutModelId(json)
        extractResultOrThrow(invokeModify(docRef, jsonNode, locale), "MODIFY_DOCUMENT")
    }

    /**
     * Partially modifies a document using DocumentParts.
     */
    fun tryPartialModify(
        docRefString: String,
        documentParts: List<DocumentPart>,
        locale: Locale? = null,
    ) {
        val docRef = DocumentReference(docRefString)
        extractResultOrThrow(invokePartialModify(docRef, documentParts, locale), "PARTIAL_MODIFY_DOCUMENT")
    }

    /**
     * Gets a document by reference.
     * @return The document or null if not found
     */
    fun tryGet(docRefString: String): DocumentV2? {
        val documentJson = tryGetJsonNode(docRefString) ?: return null
        val docRef = DocumentReference(docRefString)
        return serializer.jsonToDocumentV2(documentJson.toString(), docRef.documentModelName)
    }

    /**
     * Gets a document as JSON string.
     * @return JSON string or null if not found
     */
    fun tryGetAsJson(docRefString: String): String? {
        val documentJson = tryGetJsonNode(docRefString) ?: return null
        return documentJson.toString()
    }

    /**
     * Deletes a document.
     */
    fun tryDelete(
        docRefString: String,
        locale: Locale? = null,
    ) {
        val docRef = DocumentReference(docRefString)
        extractResultOrThrow(invokeDelete(docRef, locale), "DELETE_DOCUMENT")
    }

    /**
     * Lists documents by model name with optional filter.
     * @return List of document reference strings
     */
    fun tryList(
        documentModelName: String,
        constraint: Map<String, Any>? = null,
    ): List<String> {
        val result = extractResultOrThrow(invokeList(documentModelName, constraint), "QUERY_DOCUMENTS")
        val entries = result.get("entries")
        val docRefs = mutableListOf<String>()
        if (entries != null && entries.isArray) {
            for (entry in entries) {
                val docRef = entry
                    .get("docRef")
                    ?.stringValue()
                if (docRef != null) {
                    docRefs.add(docRef)
                }
            }
        }
        return docRefs
    }

    // =========================================================================
    // Internal invoke methods
    // =========================================================================

    private fun extractResultOrThrow(response: JsonRpc2Response, operation: String): JsonNode {
        if (response.error != null) {
            throw RuntimeException("$operation failed: ${response.error}")
        }
        return response.result
            ?: throw RuntimeException("$operation returned null result")
    }

    private fun tryGetJsonNode(docRefString: String): JsonNode? {
        val docRef = DocumentReference(docRefString)
        val response = invokeGet(docRef)
        val jsonResult = response.result
        if (jsonResult == null || jsonResult.isNull) {
            return null
        }
        val documentJson = jsonResult.get("document")
        if (documentJson == null || documentJson.isNull) {
            return null
        }
        return documentJson
    }

    private fun invokeAdd(
        documentModelName: String,
        document: JsonNode,
        locale: Locale?,
        operationId: String = "ADD_DOCUMENT",
    ): JsonRpc2Response {
        val builder =
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.ADD_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_MODEL_NAME, documentModelName)
                .putParameter(JsonRpcRequestParams.DOCUMENT, document)
        if (locale != null) {
            builder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return rpcClient
            .invoke(listOf(builder.build()))
            .single()
    }

    private fun invokeCopy(
        docRef: DocumentReference,
        locale: Locale?,
        operationId: String = "COPY_DOCUMENT",
    ): JsonRpc2Response {
        val builder =
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.COPY_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
        if (locale != null) {
            builder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return rpcClient
            .invoke(listOf(builder.build()))
            .single()
    }

    private fun invokeModify(
        docRef: DocumentReference,
        document: JsonNode,
        locale: Locale?,
        operationId: String = "MODIFY_DOCUMENT",
    ): JsonRpc2Response {
        val builder =
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.MODIFY_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
                .putParameter(JsonRpcRequestParams.DOCUMENT, document)
        if (locale != null) {
            builder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return rpcClient
            .invoke(listOf(builder.build()))
            .single()
    }

    private fun invokePartialModify(
        docRef: DocumentReference,
        documentParts: List<DocumentPart>,
        locale: Locale?,
        operationId: String = "PARTIAL_MODIFY_DOCUMENT",
    ): JsonRpc2Response {
        val builder =
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.PARTIAL_MODIFY_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, "${docRef.documentModelName}/${docRef.documentId}")
                .putParameter(JsonRpcRequestParams.DOCUMENT_PARTS, documentParts)
        if (locale != null) {
            builder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return rpcClient
            .invoke(listOf(builder.build()))
            .single()
    }

    private fun invokeGet(
        docRef: DocumentReference,
        operationId: String = "GET_DOCUMENT",
    ): JsonRpc2Response = rpcClient
        .invoke(
            listOf(
                requestBuilderFactory
                    .newJsonRpc2RequestBuilder()
                    .addMethodCall(CoreOperationConstants.GET_DOCUMENT_OPERATION)
                    .id(operationId)
                    .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef.toString())
                    .build(),
            ),
        ).single()

    private fun invokeDelete(
        docRef: DocumentReference,
        locale: Locale?,
        operationId: String = "DELETE_DOCUMENT",
    ): JsonRpc2Response {
        val builder =
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.DELETE_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
        if (locale != null) {
            builder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return rpcClient
            .invoke(listOf(builder.build()))
            .single()
    }

    private fun invokeList(
        documentModelName: String,
        constraint: Map<String, Any>?,
        operationId: String = "QUERY_DOCUMENTS",
    ): JsonRpc2Response {
        val queryBuilder = QueryRoot
            .builder()
            .targetDocumentModel(documentModelName)
            .projectionName(QueryConstants.PROJECTION_NAME_DOCUMENT)
            .paging(
                Paging
                    .builder()
                    .pageNumber(0)
                    .pageSize(100)
                    .build(),
            ).sort(
                listOf(DirectFieldOrder(QueryConstants.DATA_SERVICES_METADATA_CREATED_AT, DirectFieldOrder.Direction.ASC, DirectFieldOrder.NullHandling.NATIVE)),
            )
        if (constraint != null) {
            queryBuilder.constraint(buildConstraintOperator(constraint))
        }
        val queryRoot = queryBuilder.build()

        val builder =
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.QUERY_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.QUERY, queryRoot)
        return rpcClient
            .invoke(listOf(builder.build()))
            .single()
    }
}
