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

package com.mgmtp.a12.scripting.rpcFacade.internal.callable

import com.mgmtp.a12.dataservices.client.rpc.RequestBuilderFactory
import com.mgmtp.a12.dataservices.client.rpc.RestRpcOperationsClient
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Request
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import com.mgmtp.a12.scripting.rpcFacade.internal.JsonRpcRequestParams
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingOperationConstants.CALL_SCRIPT_OPERATION
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper

private class DataServicesCallableScriptOperationsTest {
    val mockRpcOperationsClient: RestRpcOperationsClient = mockk(relaxed = true)
    val objectMapper = jacksonObjectMapper()
    val dsRequestBuilderFactory: RequestBuilderFactory = RequestBuilderFactory(objectMapper)

    // Subject under test
    val dataservicesCallableScriptOperations = DataServicesCallableScriptOperations(mockRpcOperationsClient, dsRequestBuilderFactory)

    companion object {
        const val SCRIPT_NAME = "someScriptName"
        val arguments = mapOf("someInputKey" to "someInputValue")

        val slot = slot<List<JsonRpc2Request>>()
    }

    val argumentsAsJsonNode: JsonNode by lazy {
        objectMapper.readTree(objectMapper.writeValueAsString(arguments))
    }

    @BeforeEach
    fun setup() {
        // given
        val response = JsonRpc2Response(objectMapper.nodeFactory.textNode("{}"))
        every { mockRpcOperationsClient.invoke(capture(slot)) } returns listOf(response)
    }

    @Test
    fun `should successfully invoke CALL_SCRIPT_OPERATION operation`() {
        // when
        dataservicesCallableScriptOperations.tryCall(SCRIPT_NAME, arguments)

        // then
        val request = slot.captured
            .first()
        request.method shouldBe CALL_SCRIPT_OPERATION
        request.params
            .findValue(JsonRpcRequestParams.SCRIPT_NAME)
            .asString() shouldBe SCRIPT_NAME
        request.params
            .findValue(JsonRpcRequestParams.ARGUMENTS) shouldBe argumentsAsJsonNode
    }
}
