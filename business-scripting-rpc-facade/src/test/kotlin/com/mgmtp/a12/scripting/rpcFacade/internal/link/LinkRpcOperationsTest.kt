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
import com.mgmtp.a12.dataservices.client.rpc.RestRpcOperationsClient
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import com.mgmtp.a12.dataservices.rpc.JsonRpc2ResponseError
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentJsonSerializer
import io.kotest.matchers.string.shouldContain
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import tools.jackson.module.kotlin.jacksonObjectMapper

private class LinkRpcOperationsTest {

    companion object {
        const val WRONG_ENTITY_CODE = -32015
        const val WRONG_ENTITY_MESSAGE = "Wrong Entity"
    }

    val mockRpcOperationsClient: RestRpcOperationsClient = mockk()
    val objectMapper = jacksonObjectMapper()
    val linkRpcOperations = LinkRpcOperations(
        mockRpcOperationsClient,
        RequestBuilderFactory(objectMapper),
        objectMapper,
        mockk<DocumentJsonSerializer>(),
    )
    val linkSpec = mapOf("id" to "link-1")

    @Nested
    inner class TryDeleteLink {

        @Test
        fun `should return when DELETE_LINK succeeds`() {
            // given
            every { mockRpcOperationsClient.invoke(any()) } returns
                listOf(JsonRpc2Response(objectMapper.nodeFactory.objectNode()))

            // when / then
            assertDoesNotThrow { linkRpcOperations.tryDeleteLink(linkSpec) }
        }

        @Test
        fun `should throw when DELETE_LINK returns an error`() {
            // given
            val error = JsonRpc2ResponseError(WRONG_ENTITY_CODE, WRONG_ENTITY_MESSAGE, objectMapper.nodeFactory.objectNode())
            every { mockRpcOperationsClient.invoke(any()) } returns listOf(JsonRpc2Response(error))

            // when
            val thrown = assertThrows<RuntimeException> { linkRpcOperations.tryDeleteLink(linkSpec) }

            // then
            thrown.message shouldContain "DELETE_LINK failed"
            thrown.message shouldContain WRONG_ENTITY_MESSAGE
        }
    }
}
