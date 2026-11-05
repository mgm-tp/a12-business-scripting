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
import com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2
import com.mgmtp.a12.scripting.rpcFacade.internal.batch.BatchRpcExecutor
import com.mgmtp.a12.scripting.rpcFacade.internal.callable.DataServicesCallableScriptOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentJsonSerializer
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentRpcOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.link.LinkRpcOperations
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.util.*

private class DataServicesRpcFacadeTest {
    val mockSerializer: DocumentJsonSerializer = mockk(relaxed = true)
    val mockDocumentOps: DocumentRpcOperations = mockk(relaxed = true)
    val mockLinkOps: LinkRpcOperations = mockk(relaxed = true)
    val mockBatchExecutor: BatchRpcExecutor = mockk(relaxed = true)
    val callableScriptOperations: DataServicesCallableScriptOperations = mockk(relaxed = true)

    // Subject under test
    val dataServicesRpcFacade =
        DataServicesRpcFacade(
            mockSerializer,
            mockDocumentOps,
            mockLinkOps,
            mockBatchExecutor,
            callableScriptOperations,
        )

    companion object {
        const val DOCUMENT_MODEL_NAME = "SomeDocumentModel"
        const val DOC_REF_STRING = "${DOCUMENT_MODEL_NAME}/1"

        const val RELATIONSHIP_MODEL_NAME = "SomeRelationshipModel"
        const val ROLE = "someSourceRole"
        const val LINK_REF = "${RELATIONSHIP_MODEL_NAME}:1"
        val linkDescriptor = mapOf("relationshipModelName" to RELATIONSHIP_MODEL_NAME)

        const val JSON_STRING = """{"field": "value"}"""
        val filter = mapOf("field" to "value")

        const val SCRIPT_NAME = "someScriptName"
        val arguments = mapOf("someInputKey" to "someInputValue")
    }

    @Nested
    @DisplayName("Document operations")
    inner class DocumentOperations {
        val mockDocument: DocumentV2 = mockk(relaxed = true)
        val mockDocumentParts: List<DocumentPart> = listOf(mockk(relaxed = true))
        val locale: Locale = Locale.ENGLISH

        @Test
        fun `tryAddDocument should call tryAdd with correct parameters`() {
            dataServicesRpcFacade.tryAddDocument(DOCUMENT_MODEL_NAME, mockDocument, locale)
            verify { mockDocumentOps.tryAdd(DOCUMENT_MODEL_NAME, mockDocument, locale) }
        }

        @Test
        fun `tryCopyDocument should call tryCopy with correct parameters`() {
            dataServicesRpcFacade.tryCopyDocument(DOC_REF_STRING, locale)
            verify { mockDocumentOps.tryCopy(DOC_REF_STRING, locale) }
        }

        @Test
        fun `tryModifyDocument should call tryModify with correct parameters`() {
            dataServicesRpcFacade.tryModifyDocument(DOC_REF_STRING, mockDocument, locale)
            verify { mockDocumentOps.tryModify(DOC_REF_STRING, mockDocument, locale) }
        }

        @Test
        fun `tryModifyDocumentFromJson should call tryModifyFromJson with correct parameters`() {
            dataServicesRpcFacade.tryModifyDocumentFromJson(DOC_REF_STRING, JSON_STRING, locale)
            verify { mockDocumentOps.tryModifyFromJson(DOC_REF_STRING, JSON_STRING, locale) }
        }

        @Test
        fun `tryPartialModifyDocument should call tryPartialModify with correct parameters`() {
            dataServicesRpcFacade.tryPartialModifyDocument(DOC_REF_STRING, mockDocumentParts, locale)
            verify { mockDocumentOps.tryPartialModify(DOC_REF_STRING, mockDocumentParts, locale) }
        }

        @Test
        fun `tryGetDocument should call tryGet with correct docRef`() {
            dataServicesRpcFacade.tryGetDocument(DOC_REF_STRING)
            verify { mockDocumentOps.tryGet(DOC_REF_STRING) }
        }

        @Test
        fun `tryGetDocumentAsJson should call tryGetAsJson with correct docRef`() {
            dataServicesRpcFacade.tryGetDocumentAsJson(DOC_REF_STRING)
            verify { mockDocumentOps.tryGetAsJson(DOC_REF_STRING) }
        }

        @Test
        fun `tryDeleteDocument should call tryDelete with correct parameters`() {
            dataServicesRpcFacade.tryDeleteDocument(DOC_REF_STRING, locale)
            verify { mockDocumentOps.tryDelete(DOC_REF_STRING, locale) }
        }

        @Test
        fun `tryListDocuments should call tryList with correct parameters`() {
            dataServicesRpcFacade.tryListDocuments(DOCUMENT_MODEL_NAME, filter)
            verify { mockDocumentOps.tryList(DOCUMENT_MODEL_NAME, filter) }
        }
    }

    @Nested
    @DisplayName("Link operations")
    inner class LinkOperations {
        val mockLinkDocument: DocumentV2 = mockk(relaxed = true)

        @Test
        fun `tryAddLink should call tryAddLink with correct parameters`() {
            dataServicesRpcFacade.tryAddLink(linkDescriptor, mockLinkDocument)
            verify { mockLinkOps.tryAddLink(linkDescriptor, mockLinkDocument) }
        }

        @Test
        fun `tryDeleteLink should call tryDeleteLink with correct linkSpec`() {
            dataServicesRpcFacade.tryDeleteLink(linkDescriptor)
            verify { mockLinkOps.tryDeleteLink(linkDescriptor) }
        }

        @Test
        fun `tryListLinks should call tryList with correct parameters`() {
            dataServicesRpcFacade.tryListLinks(RELATIONSHIP_MODEL_NAME, DOC_REF_STRING, ROLE)
            verify { mockLinkOps.tryList(RELATIONSHIP_MODEL_NAME, DOC_REF_STRING, ROLE) }
        }
    }

    @Nested
    @DisplayName("Batch operations")
    inner class BatchOperations {
        @Test
        fun `batchCall should call execute with correct batch`() {
            val batch = mutableListOf<MutableMap<String?, Any?>>()
            dataServicesRpcFacade.batchCall(batch)
            verify { mockBatchExecutor.execute(batch) }
        }
    }

    @Nested
    @DisplayName("Serialization operations")
    inner class SerializationOperations {
        val mockDocument: DocumentV2 = mockk(relaxed = true)

        @Test
        fun `documentV2ToJson should call serializer with correct document`() {
            dataServicesRpcFacade.documentV2ToJson(mockDocument)
            verify { mockSerializer.documentV2ToJson(mockDocument) }
        }

        @Test
        fun `jsonToDocumentV2 should call serializer with correct parameters`() {
            dataServicesRpcFacade.jsonToDocumentV2(JSON_STRING, DOCUMENT_MODEL_NAME)
            verify { mockSerializer.jsonToDocumentV2(JSON_STRING, DOCUMENT_MODEL_NAME) }
        }
    }

    @Nested
    @DisplayName("Callable script operations")
    inner class CallableScriptOperations {
        @Test
        fun `tryCallScript should call tryCall with correct parameters`() {
            dataServicesRpcFacade.tryCallScript(SCRIPT_NAME, arguments)
            verify { callableScriptOperations.tryCall(SCRIPT_NAME, arguments) }
        }
    }
}
