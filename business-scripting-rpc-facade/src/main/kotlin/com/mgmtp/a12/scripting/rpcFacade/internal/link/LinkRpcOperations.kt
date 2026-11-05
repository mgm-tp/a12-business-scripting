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

package com.mgmtp.a12.scripting.rpcFacade.internal.link

import com.mgmtp.a12.dataservices.client.rpc.RequestBuilderFactory
import com.mgmtp.a12.dataservices.client.rpc.RpcOperationsClient
import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.dataservices.document.operation.CoreOperationConstants
import com.mgmtp.a12.dataservices.query.Paging
import com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator
import com.mgmtp.a12.dataservices.query.topology.QueryLink
import com.mgmtp.a12.dataservices.query.topology.QueryRoot
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import com.mgmtp.a12.scripting.rpcFacade.internal.JsonRpcRequestParams
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentJsonSerializer
import com.mgmtp.a12.scripting.rpcFacade.internal.query.QueryConstants
import tools.jackson.databind.ObjectMapper

/**
 * RPC operations for A12 Relationship Links.
 */
class LinkRpcOperations(
    private val rpcClient: RpcOperationsClient,
    private val requestBuilderFactory: RequestBuilderFactory,
    private val objectMapper: ObjectMapper,
    private val serializer: DocumentJsonSerializer,
) {
    /** Throws with operation name when the response carries an error. */
    private fun throwIfError(
        response: JsonRpc2Response,
        operation: String,
    ) {
        if (response.error != null) {
            throw RuntimeException("$operation failed: ${response.error}")
        }
    }

    /** Extracts link ID from response or throws with operation name. */
    private fun extractLinkIdOrThrow(
        response: JsonRpc2Response,
        operation: String,
    ): String {
        throwIfError(response, operation)
        return response.result
            ?.get("id")
            ?.stringValue()
            ?: throw RuntimeException("$operation returned no link ID")
    }

    /**
     * Creates a link between documents.
     * @param linkDescriptor The link descriptor in DS format (from TypeScript toDsLinkDescriptor)
     * @param linkDocument Optional link document to attach (DocumentV2, JSON string, or Map)
     * @return The created link ID
     */
    fun tryAddLink(
        linkDescriptor: Any,
        linkDocument: Any?,
    ): String {
        val response = invokeAddLink(linkDescriptor, linkDocument, "ADD_LINK")
        return extractLinkIdOrThrow(response, "ADD_LINK")
    }

    /**
     * Deletes a link.
     * @param linkSpec The link spec containing id and linkDescriptor
     */
    fun tryDeleteLink(linkSpec: Any) {
        val response = invokeDeleteLink(linkSpec, "DELETE_LINK")
        throwIfError(response, "DELETE_LINK")
    }

    /**
     * Lists links for a document with a specific role.
     * @param relationshipModelName The relationship model name
     * @param docRefString Document reference as string
     * @param role The role of the document in the relationship
     * @return JSON string of the `links` array (serialized DocumentTreeResult entries) from the QUERY_OPERATION response
     */
    fun tryList(
        relationshipModelName: String,
        docRefString: String,
        role: String,
    ): String {
        val docRef = DocumentReference(docRefString)
        val response = invokeList(relationshipModelName, docRef, role, "QUERY_LINKS")
        val links = response.result?.get("links")
        val jsonResult = objectMapper.writeValueAsString(links ?: emptyList<Any>())
        return jsonResult
    }

    // =========================================================================
    // Internal invoke methods
    // =========================================================================

    private fun invokeAddLink(
        linkDescriptor: Any,
        linkDocument: Any?,
        operationId: String,
    ): JsonRpc2Response {
        val linkDocJson = serializer.toJsonNode(linkDocument)
        val responses = rpcClient.invoke(
            listOf(
                requestBuilderFactory
                    .newJsonRpc2RequestBuilder()
                    .addMethodCall(CoreOperationConstants.ADD_LINK_OPERATION)
                    .id(operationId)
                    .putParameter(JsonRpcRequestParams.LINK_DESCRIPTOR, linkDescriptor)
                    .apply { if (linkDocJson != null) putParameter(JsonRpcRequestParams.LINK_DOCUMENT, linkDocJson) }
                    .build(),
            ),
        )
        // For some DS-side checks, there are two responses with second containing the error
        val errorResponse = responses.find { it.error != null }
        if (errorResponse != null) {
            return errorResponse
        }
        return responses[0]
    }

    private fun invokeDeleteLink(
        linkSpec: Any,
        operationId: String,
    ): JsonRpc2Response = rpcClient.invoke(
        listOf(
            requestBuilderFactory
                .newJsonRpc2RequestBuilder()
                .addMethodCall(CoreOperationConstants.DELETE_LINK_OPERATION)
                .id(operationId)
                .putParameter(JsonRpcRequestParams.LINK_REFERENCE, linkSpec)
                .build(),
        ),
    )[0]

    private fun invokeList(
        relationshipModelName: String,
        docRef: DocumentReference,
        role: String,
        operationId: String?,
    ): JsonRpc2Response {
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

        return rpcClient
            .invoke(
                listOf(
                    requestBuilderFactory
                        .newJsonRpc2RequestBuilder()
                        .addMethodCall(CoreOperationConstants.QUERY_OPERATION)
                        .id(operationId)
                        .putParameter(JsonRpcRequestParams.QUERY, query)
                        .build(),
                ),
            ).single()
    }
}
