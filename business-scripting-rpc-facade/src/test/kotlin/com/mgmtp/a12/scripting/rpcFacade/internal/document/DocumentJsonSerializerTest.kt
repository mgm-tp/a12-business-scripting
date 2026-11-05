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
import com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2
import com.mgmtp.a12.kernel.md.document.apiV2.services.IDocumentV2Serializer
import com.mgmtp.a12.model.notification.RankedNotification
import com.mgmtp.a12.model.notification.Severity
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldInclude
import io.kotest.matchers.types.shouldBeSameInstanceAs
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import tools.jackson.databind.ObjectMapper
import java.io.Reader
import java.io.Writer
import java.util.function.Consumer

@ExtendWith(OutputCaptureExtension::class)
private class DocumentJsonSerializerTest {

    companion object {
        const val DOCUMENT_MODEL_ID = "Project_DM"
        const val JSON = "{}"
    }

    val mockDocumentV2: DocumentV2 = mockk(relaxed = true)
    val mockDocumentV2Serializer: IDocumentV2Serializer = mockk(relaxed = true)
    val objectMapper = ObjectMapper()

    val serializer = DocumentJsonSerializer(mockDocumentV2Serializer, objectMapper)

    fun mockDeserializeV2WithNotifications(vararg notifications: Pair<String, String>) {
        every<DocumentV2> {
            mockDocumentV2Serializer.deserializeV2(
                any<Reader>(),
                any<String>(),
                any<DocumentDeserializationConfig>(),
                any<Consumer<RankedNotification>>(),
            )
        } answers {
            val consumer = arg<Consumer<RankedNotification>>(3)
            notifications.forEach { (severity, message) ->
                val notification = mockk<RankedNotification>(relaxed = true)
                // Severity is an enum, which MockK cannot mock further, so stub the getter
                // directly with a real constant instead of chaining through `.severity.name`.
                every { notification.severity } returns Severity.valueOf(severity)
                every { notification.message } returns message
                consumer.accept(notification)
            }
            mockDocumentV2
        }
    }

    @Nested
    @DisplayName("toJsonNode")
    inner class ToJsonNode {

        @Test
        fun `should return null for null input`() {
            serializer.toJsonNode(null).shouldBeNull()
        }

        @Test
        fun `should convert a Map to a JsonNode`() {
            // when
            val result = serializer.toJsonNode(mapOf("Assignment" to mapOf("Allocation" to 50)))

            // then
            result!!.get("Assignment").get("Allocation").intValue() shouldBe 50
        }

        @Test
        fun `should convert a JSON string to a JsonNode`() {
            // when
            val result = serializer.toJsonNode("""{"Assignment":{"Allocation":50}}""")

            // then
            result!!.get("Assignment").get("Allocation").intValue() shouldBe 50
        }

        @Test
        fun `should convert a DocumentV2 to a JsonNode via the Kernel serializer`() {
            // given
            every {
                mockDocumentV2Serializer.serializeV2(any<DocumentV2>(), any<Writer>(), any())
            } answers {
                arg<Writer>(1).write("""{"Assignment":{"Allocation":50}}""")
            }

            // when
            val result = serializer.toJsonNode(mockDocumentV2)

            // then
            result!!.get("Assignment").get("Allocation").intValue() shouldBe 50
        }
    }

    @Nested
    @DisplayName("jsonToDocumentV2")
    inner class JsonToDocumentV2 {

        @Test
        fun `should throw when Kernel reports ERROR notification`() {
            // given
            mockDeserializeV2WithNotifications("ERROR" to "field mismatch")

            // when / then
            assertThrows<IllegalStateException> {
                serializer.jsonToDocumentV2(JSON, DOCUMENT_MODEL_ID)
            }
        }

        @Test
        fun `should include document model id and Kernel error message in exception`() {
            // given
            mockDeserializeV2WithNotifications("ERROR" to "field mismatch")

            // when
            val exception = assertThrows<IllegalStateException> {
                serializer.jsonToDocumentV2(JSON, DOCUMENT_MODEL_ID)
            }

            // then
            exception.message!! shouldInclude DOCUMENT_MODEL_ID
            exception.message!! shouldInclude "field mismatch"
        }

        @Test
        fun `should concatenate multiple ERROR messages separated by semicolons`() {
            // given
            mockDeserializeV2WithNotifications("ERROR" to "first error", "ERROR" to "second error")

            // when
            val exception = assertThrows<IllegalStateException> {
                serializer.jsonToDocumentV2(JSON, DOCUMENT_MODEL_ID)
            }

            // then
            exception.message!! shouldInclude "first error; second error"
        }

        @Test
        fun `should return document when Kernel reports only WARNING notifications`() {
            // given
            mockDeserializeV2WithNotifications("WARNING" to "some warning")

            // when
            val result = serializer.jsonToDocumentV2(JSON, DOCUMENT_MODEL_ID)

            // then
            result shouldBeSameInstanceAs mockDocumentV2
        }

        @Test
        fun `should return document when Kernel reports no notifications`() {
            // given
            mockDeserializeV2WithNotifications()

            // when
            val result = serializer.jsonToDocumentV2(JSON, DOCUMENT_MODEL_ID)

            // then
            result shouldBeSameInstanceAs mockDocumentV2
        }

        @Test
        fun `should log warning when Kernel reports WARNING notifications`(capturedOutput: CapturedOutput) {
            // given
            mockDeserializeV2WithNotifications("WARNING" to "DeserializationTestWarning")

            // when
            serializer.jsonToDocumentV2(JSON, DOCUMENT_MODEL_ID)

            // then
            capturedOutput.toString() shouldInclude "DeserializationTestWarning"
        }
    }
}
