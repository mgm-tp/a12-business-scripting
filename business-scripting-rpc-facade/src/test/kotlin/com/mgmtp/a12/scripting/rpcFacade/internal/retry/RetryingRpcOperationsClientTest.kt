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

package com.mgmtp.a12.scripting.rpcFacade.internal.retry

import com.mgmtp.a12.dataservices.client.exception.BadRequest
import com.mgmtp.a12.dataservices.client.exception.ErrorDetail
import com.mgmtp.a12.dataservices.client.rpc.RpcOperationsClient
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Request
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException

private class RetryingRpcOperationsClientTest {

    private val delegate = mockk<RpcOperationsClient>()
    private val noDelayProperties = RpcRetryProperties(maxAttempts = 3, initialDelayMs = 0, multiplier = 1.0)
    private val client = RetryingRpcOperationsClient(delegate, noDelayProperties)

    companion object {
        val EMPTY_REQUESTS = emptyList<JsonRpc2Request>()

        private val successResponse = listOf(mockk<JsonRpc2Response>(relaxed = true))
        private val serverError = HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR)
        private val timeoutError = ResourceAccessException("Connection timed out")

        val retryableExceptions = listOf(
            "HttpServerErrorException" to serverError,
            "ResourceAccessException" to timeoutError,
        )

        val nonRetryableExceptions = listOf(
            "HttpClientErrorException" to HttpClientErrorException(HttpStatus.UNPROCESSABLE_ENTITY),
            "BadRequest" to BadRequest("bad request", mockk<ErrorDetail>()),
            "unknown RuntimeException" to RuntimeException("unexpected"),
        )
    }

    @Test
    fun `should invoke delegate once on success`() {
        // given
        every { delegate.invoke(any()) } returns successResponse

        // when
        val result = client.invoke(EMPTY_REQUESTS)

        // then
        result shouldBe successResponse
        verify(exactly = 1) { delegate.invoke(any()) }
    }

    @TestFactory
    fun `should retry on retryable exception and succeed`(): List<DynamicTest> = retryableExceptions.map { (name, exception) ->
        dynamicTest(name) {
            clearMocks(delegate)
            // given
            var firstTry = true
            every { delegate.invoke(any()) } answers {
                if (firstTry) {
                    firstTry = false
                    throw exception
                }
                successResponse
            }

            // when
            val result = client.invoke(EMPTY_REQUESTS)

            // then
            result shouldBe successResponse
            verify(exactly = 2) { delegate.invoke(any()) }
        }
    }

    @TestFactory
    fun `should rethrow immediately on non-retryable exception`(): List<DynamicTest> = nonRetryableExceptions.map { (name, exception) ->
        dynamicTest(name) {
            clearMocks(delegate)
            // given
            every { delegate.invoke(any()) } throws exception

            // when / then
            val thrown = assertThrows<RuntimeException> { client.invoke(EMPTY_REQUESTS) }
            thrown shouldBe exception
            verify(exactly = 1) { delegate.invoke(any()) }
        }
    }

    @Test
    fun `should throw last exception after max attempts exhausted`() {
        // given
        every { delegate.invoke(any()) } throws serverError

        // when / then
        val thrown = assertThrows<HttpServerErrorException> { client.invoke(EMPTY_REQUESTS) }
        thrown shouldBe serverError
        verify(exactly = 3) { delegate.invoke(any()) }
    }

    @Test
    fun `should respect maxAttempts=1 (no retry)`() {
        // given
        val singleAttemptClient = RetryingRpcOperationsClient(
            delegate,
            RpcRetryProperties(maxAttempts = 1, initialDelayMs = 0, multiplier = 1.0),
        )
        every { delegate.invoke(any()) } throws serverError

        // when / then
        val thrown = assertThrows<HttpServerErrorException> { singleAttemptClient.invoke(EMPTY_REQUESTS) }
        thrown shouldBe serverError
        verify(exactly = 1) { delegate.invoke(any()) }
    }
}
