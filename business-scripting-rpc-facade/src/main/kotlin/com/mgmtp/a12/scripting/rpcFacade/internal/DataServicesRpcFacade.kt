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

package com.mgmtp.a12.scripting.rpcFacade.internal

import com.mgmtp.a12.dataservices.document.DocumentPart
import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2
import com.mgmtp.a12.scripting.rpcFacade.internal.batch.BatchRpcExecutor
import com.mgmtp.a12.scripting.rpcFacade.internal.callable.DataServicesCallableScriptOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentJsonSerializer
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentRpcOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.link.LinkRpcOperations
import java.util.*

/**
 * Central facade for DataServices RPC operations.
 * Delegates to specialized operation classes for Documents, Links, and Batch calls.
 */
class DataServicesRpcFacade(
    private val serializer: DocumentJsonSerializer,
    private val documentOps: DocumentRpcOperations,
    private val linkOps: LinkRpcOperations,
    private val batchExecutor: BatchRpcExecutor,
    private val callableScriptOperations: DataServicesCallableScriptOperations,
) {
    // =========================================================================
    // Document Operations (delegated)
    // =========================================================================

    fun tryAddDocument(
        docModelName: String,
        document: Any? = null,
        locale: Locale? = null,
    ): DocumentReference = documentOps.tryAdd(docModelName, document, locale)

    fun tryCopyDocument(
        docRefString: String,
        locale: Locale? = null,
    ): String = documentOps.tryCopy(docRefString, locale)

    fun tryModifyDocument(
        docRefString: String,
        document: DocumentV2,
        locale: Locale? = null,
    ) = documentOps.tryModify(docRefString, document, locale)

    fun tryModifyDocumentFromJson(
        docRefString: String,
        json: String,
        locale: Locale? = null,
    ) = documentOps.tryModifyFromJson(docRefString, json, locale)

    fun tryPartialModifyDocument(
        docRefString: String,
        documentParts: List<DocumentPart>,
        locale: Locale? = null,
    ) = documentOps.tryPartialModify(docRefString, documentParts, locale)

    fun tryGetDocument(docRefString: String): DocumentV2? = documentOps.tryGet(docRefString)

    fun tryGetDocumentAsJson(docRefString: String): String? = documentOps.tryGetAsJson(docRefString)

    fun tryDeleteDocument(
        docRefString: String,
        locale: Locale? = null,
    ) = documentOps.tryDelete(docRefString, locale)

    fun tryListDocuments(
        documentModelName: String,
        constraint: Map<String, Any>? = null,
    ): List<String> = documentOps.tryList(documentModelName, constraint)

    // =========================================================================
    // Link Operations (delegated)
    // =========================================================================

    fun tryAddLink(
        linkDescriptor: Any,
        linkDocument: Any? = null,
    ): String = linkOps.tryAddLink(linkDescriptor, linkDocument)

    fun tryDeleteLink(linkSpec: Any) = linkOps.tryDeleteLink(linkSpec)

    fun tryListLinks(
        relationshipModelName: String,
        docRefString: String,
        role: String,
    ): String = linkOps.tryList(relationshipModelName, docRefString, role)

    // =========================================================================
    // Batch Operations (delegated)
    // =========================================================================

    fun batchCall(batch: MutableList<MutableMap<String?, Any?>>): MutableList<Any?> = batchExecutor.execute(batch)

    // =========================================================================
    // Serialization (delegated, exposed for direct access if needed)
    // =========================================================================

    fun documentV2ToJson(document: DocumentV2): String = serializer.documentV2ToJson(document)

    fun jsonToDocumentV2(
        json: String,
        documentModelId: String,
    ): DocumentV2 = serializer.jsonToDocumentV2(json, documentModelId)

    // =========================================================================
    // Call script (delegated)
    // =========================================================================

    fun tryCallScript(
        scriptName: String,
        arguments: Map<String, Any?>,
    ): String? = callableScriptOperations.tryCall(scriptName, arguments)
}
