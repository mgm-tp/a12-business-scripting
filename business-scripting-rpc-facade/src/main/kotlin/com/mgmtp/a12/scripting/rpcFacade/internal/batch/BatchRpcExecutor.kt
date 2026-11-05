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

package com.mgmtp.a12.scripting.rpcFacade.internal.batch

import com.mgmtp.a12.dataservices.client.rpc.RequestBuilderFactory
import com.mgmtp.a12.dataservices.client.rpc.RpcOperationsClient
import com.mgmtp.a12.dataservices.client.rpc.internal.JsonRpc2RequestBuilder
import com.mgmtp.a12.dataservices.document.DocumentPart
import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.dataservices.document.operation.CoreOperationConstants
import com.mgmtp.a12.dataservices.query.DirectFieldOrder
import com.mgmtp.a12.dataservices.query.Paging
import com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator
import com.mgmtp.a12.dataservices.query.topology.QueryLink
import com.mgmtp.a12.dataservices.query.topology.QueryRoot
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Request
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import com.mgmtp.a12.kernel.md.document.apiV2.immutable.FieldInstanceV2
import com.mgmtp.a12.scripting.rpcFacade.internal.JsonRpcRequestParams
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentJsonSerializer
import com.mgmtp.a12.scripting.rpcFacade.internal.query.QueryConstants
import com.mgmtp.a12.scripting.rpcFacade.internal.query.buildConstraintOperator
import tools.jackson.databind.ObjectMapper
import java.util.*
import kotlin.collections.get

/**
 * Executes batch RPC calls to DataServices.
 */
class BatchRpcExecutor(
    private val rpcClient: RpcOperationsClient,
    private val requestBuilderFactory: RequestBuilderFactory,
    private val serializer: DocumentJsonSerializer,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        private const val METHOD_DOCUMENTS_CREATE = "A12.Documents.create"
        private const val METHOD_DOCUMENTS_COPY = "A12.Documents.copy"
        private const val METHOD_DOCUMENTS_GET = "A12.Documents.get"
        private const val METHOD_DOCUMENTS_MODIFY = "A12.Documents.modify"
        private const val METHOD_DOCUMENTS_REMOVE = "A12.Documents.remove"
        private const val METHOD_DOCUMENTS_FIND = "A12.Documents.find"
        private const val METHOD_DOCUMENTS_WRITE_FIELDS = "A12.Documents.writeFields"
        private const val METHOD_LINKS_CREATE = "A12.Links.create"
        private const val METHOD_LINKS_FIND = "A12.Links.find"
        private const val METHOD_LINKS_REMOVE = "A12.Links.remove"
    }

    /**
     * Executes a batch of RPC calls.
     * @param batch List of method calls with their parameters
     * @return List of results in the same order as the input batch
     */
    fun execute(batch: MutableList<MutableMap<String?, Any?>>): MutableList<Any?> {
        val results = mutableListOf<Any?>()
        val requests = mutableListOf<JsonRpc2Request?>()

        for (i in batch.indices) {
            val call = batch[i]
            val methodName = call["method"] as String
            val params = call["params"]
            val operationId = "BATCH_${methodName}_$i"
            requests.add(buildRequest(methodName, (params as MutableMap<*, *>?)!!, operationId))
        }

        val responses = rpcClient.invoke(requests)

        for (response in responses) {
            if (response.error != null) {
                results.add(mapOf("error" to response.error))
            } else {
                val result = parseResponse(response, batch)
                results.add(result)
            }
        }

        return results
    }

    private fun parseResponse(
        response: JsonRpc2Response,
        batch: MutableList<MutableMap<String?, Any?>>,
    ): Any? = when {
        response.id
            .contains(METHOD_DOCUMENTS_CREATE) -> {
            val docRef = response.result
                .get("docRef")
                .stringValue()
            mapOf("docRef" to docRef)
        }
        response.id
            .contains(METHOD_DOCUMENTS_COPY) -> {
            val docRef = response.result
                .get("docRef")
                .stringValue()
            mapOf("docRef" to docRef)
        }
        response.id
            .contains(METHOD_DOCUMENTS_GET) -> {
            val index = response.id
                .substringAfterLast("_")
                .toInt()
            val params = batch[index]["params"] as MutableMap<*, *>
            val docRefStr = getDocRefFromParams(params)
            val dmName = docRefStr?.substringBefore("/")
            val documentJson = response.result
                ?.get("document")
            if (documentJson == null || documentJson.isNull) {
                null
            } else {
                serializer.jsonToDocumentV2(documentJson.toString(), dmName!!)
            }
        }
        response.id
            .contains(METHOD_LINKS_CREATE) -> {
            response.result["id"]
                .stringValue()
        }
        response.id
            .contains(METHOD_LINKS_FIND) -> {
            // Return the `links` array (serialized DocumentTreeResult entries) as JSON string
            val links = response.result.get("links")
            objectMapper.writeValueAsString(links ?: emptyList<Any>())
        }
        response.id
            .contains(METHOD_DOCUMENTS_FIND) -> {
            val entries = response.result
                .get("entries")
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
            docRefs
        }
        else -> response.result
    }

    // =========================================================================
    // Request Builders
    // =========================================================================

    private fun buildRequest(
        methodName: String,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val builder = requestBuilderFactory.newJsonRpc2RequestBuilder()
        return when (methodName) {
            METHOD_LINKS_CREATE -> buildAddLinkRequest(builder, paramMap, operationId)
            METHOD_LINKS_REMOVE -> buildDeleteLinkRequest(builder, paramMap, operationId)
            METHOD_LINKS_FIND -> buildListLinksRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_CREATE -> buildAddDocumentRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_COPY -> buildCopyDocumentRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_MODIFY -> buildModifyDocumentRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_GET -> buildGetDocumentRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_REMOVE -> buildDeleteDocumentRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_FIND -> buildListDocumentsRequest(builder, paramMap, operationId)
            METHOD_DOCUMENTS_WRITE_FIELDS -> buildWriteFieldsRequest(builder, paramMap, operationId)
            else -> throw IllegalArgumentException("Unknown method: $methodName")
        }
    }

    private fun buildAddDocumentRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val documentModelName = paramMap["documentModelName"].toString()
        val json = serializer.toJsonString(paramMap["document"])
        builder
            .addMethodCall(CoreOperationConstants.ADD_DOCUMENT_OPERATION)
            .id(operationId)
            .putParameter(JsonRpcRequestParams.DOCUMENT_MODEL_NAME, documentModelName)
            .putParameter(JsonRpcRequestParams.DOCUMENT, serializer.toJsonNodeWithoutModelId(json))
        return builder.build()[0]
    }

    private fun buildCopyDocumentRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val docRef = getDocRefFromParams(paramMap)
        val locale = paramMap["locale"] as Locale?
        val methodCallBuilder =
            builder
                .addMethodCall(CoreOperationConstants.COPY_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
        if (locale != null) {
            methodCallBuilder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return builder.build()[0]
    }

    private fun buildModifyDocumentRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val docRef = getDocRefFromParams(paramMap)
        val locale = paramMap["locale"] as Locale?
        val json = serializer.toJsonString(paramMap["document"])
        val jsonNode = serializer.toJsonNodeWithoutModelId(json)
        val methodCallBuilder =
            builder
                .addMethodCall(CoreOperationConstants.MODIFY_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
                .putParameter(JsonRpcRequestParams.DOCUMENT, jsonNode)
        if (locale != null) {
            methodCallBuilder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return builder.build()[0]
    }

    private fun buildGetDocumentRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val docRef = getDocRefFromParams(paramMap)
        builder
            .addMethodCall(CoreOperationConstants.GET_DOCUMENT_OPERATION)
            .id(operationId)
            .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
        return builder.build()[0]
    }

    private fun buildDeleteDocumentRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val docRef = getDocRefFromParams(paramMap)
        val locale = paramMap["locale"] as Locale?
        val methodCallBuilder =
            builder
                .addMethodCall(CoreOperationConstants.DELETE_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
        if (locale != null) {
            methodCallBuilder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return builder.build()[0]
    }

    private fun buildListDocumentsRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val documentModelName = paramMap["documentModelName"].toString()

        @Suppress("UNCHECKED_CAST")
        val constraint: Map<String, Any>? = paramMap["constraint"] as? Map<String, Any>

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
            ).sort(listOf(DirectFieldOrder(QueryConstants.DATA_SERVICES_METADATA_CREATED_AT, DirectFieldOrder.Direction.ASC, DirectFieldOrder.NullHandling.NATIVE)))
        if (constraint != null) {
            queryBuilder.constraint(buildConstraintOperator(constraint))
        }
        val queryRoot = queryBuilder.build()

        builder
            .addMethodCall(CoreOperationConstants.QUERY_OPERATION)
            .id(operationId)
            .putParameter(JsonRpcRequestParams.QUERY, queryRoot)
        return builder.build()[0]
    }

    private fun buildWriteFieldsRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val docRef = getDocRefFromParams(paramMap)
        val locale = paramMap["locale"] as Locale?
        val fields = paramMap["fields"]
        val documentParts = mutableListOf<DocumentPart?>()

        if (fields is MutableList<*> && fields.isNotEmpty()) {
            fields.forEach { field ->
                val docPart = createDocumentPartFromField(field, paramMap)
                documentParts.add(docPart)
            }
        } else {
            throw IllegalArgumentException("Parameter type for fields is not a filled list")
        }

        val methodCallBuilder =
            builder
                .addMethodCall(CoreOperationConstants.PARTIAL_MODIFY_DOCUMENT_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.DOCUMENT_REFERENCE, docRef)
                .putParameter(JsonRpcRequestParams.DOCUMENT_PARTS, documentParts)
        if (locale != null) {
            methodCallBuilder.putParameter(JsonRpcRequestParams.LOCALE, locale)
        }
        return builder.build()[0]
    }

    private fun buildAddLinkRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val linkDescriptor = paramMap["linkDescriptor"]
        val linkDocJson = serializer.toJsonNode(paramMap["linkDocument"])
        val methodCallBuilder =
            builder
                .addMethodCall(CoreOperationConstants.ADD_LINK_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.LINK_DESCRIPTOR, linkDescriptor)
        if (linkDocJson != null) {
            methodCallBuilder.putParameter(JsonRpcRequestParams.LINK_DOCUMENT, linkDocJson)
        }
        return builder.build()[0]
    }

    private fun buildDeleteLinkRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val linkSpec = paramMap["linkSpec"]
        builder
            .addMethodCall(CoreOperationConstants.DELETE_LINK_OPERATION)
            .id(operationId)
            .putParameter(JsonRpcRequestParams.LINK_REFERENCE, linkSpec)
        return builder.build()[0]
    }

    private fun buildListLinksRequest(
        builder: JsonRpc2RequestBuilder,
        paramMap: MutableMap<*, *>,
        operationId: String?,
    ): JsonRpc2Request? {
        val relationshipModelName = paramMap["relationshipModelName"].toString()
        val role = paramMap["role"].toString()
        val docRef = DocumentReference(paramMap["docRef"].toString())

        val documentModelName = docRef.documentModelName
        val queryLink = QueryLink
            .builder()
            .relationshipModel(relationshipModelName)
            .targetRole(role)
            // max depth is needed for recursive relationships
            .maxDepth(1)
            .build()
        val query = QueryRoot
            .builder()
            // targetDocumentModel here is the DM name of documents to query, not the relationship's target DM.
            .targetDocumentModel(documentModelName)
            .projectionName(QueryConstants.PROJECTION_NAME_DOCUMENT)
            .link(queryLink)
            .constraint(
                ExactMatchOperator<String>()
                    .apply {
                        field = QueryConstants.DATA_SERVICES_METADATA_DOC_REF
                        value = docRef.toString()
                    },
            ).paging(
                Paging
                    .builder()
                    .pageNumber(0)
                    .pageSize(100)
                    .build(),
            ).build()

        builder
            .addMethodCall(CoreOperationConstants.QUERY_OPERATION)
            .id(operationId)
            .putParameter(JsonRpcRequestParams.QUERY, query)
        return builder.build()[0]
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private fun getDocRefFromParams(params: MutableMap<*, *>): String? = if (params["docRef"] != null) {
        params["docRef"].toString()
    } else {
        params["documentReference"].toString()
    }

    private fun getDefaultRepetitionsIfEmpty(
        path: String,
        repetitions: IntArray?,
    ): IntArray {
        if (repetitions == null || repetitions.isEmpty()) {
            val length = path
                .split("/")
                .filter { it.isNotEmpty() }
                .size
            return IntArray(length) { 1 }
        }
        return repetitions
    }

    private fun createDocumentPartFromField(
        field: Any?,
        paramMap: MutableMap<*, *>,
    ): DocumentPart {
        val path: String
        val value: Any?
        var repetitions: IntArray?

        when (field) {
            is FieldInstanceV2 -> {
                path = paramMap["path"]?.toString()
                    ?: throw IllegalArgumentException("FieldInstanceV2 requires 'path' in params")
                value = field.value()
                repetitions = (paramMap["repetitions"] as? List<*>)
                    ?.map { (it as Number).toInt() }
                    ?.toIntArray()
            }
            is Map<*, *> -> {
                path = (field["path"] ?: field["field"])?.toString()
                    ?: throw IllegalArgumentException("Field object missing 'path' or 'field' property")
                value = field["value"]
                repetitions = (field["repetitions"] as? List<*>)
                    ?.map { (it as Number).toInt() }
                    ?.toIntArray()
            }
            is String ->
                if (paramMap.containsKey("value") && paramMap.containsKey("repetitions")) {
                    path = field
                    value = paramMap["value"]
                    repetitions = paramMap["repetitions"] as IntArray?
                } else {
                    throw IllegalArgumentException("Unsupported type for fields or missing params: ${field.javaClass}")
                }
            else -> {
                throw IllegalArgumentException("Unsupported type for fields or missing params: ${field?.javaClass}")
            }
        }

        repetitions = getDefaultRepetitionsIfEmpty(path, repetitions)
        return DocumentPart(path, value, repetitions)
    }
}
