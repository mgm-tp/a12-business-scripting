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

package com.mgmtp.a12.scripting.dataservices.callable

import com.mgmtp.a12.dataservices.common.exception.NotFoundException
import com.mgmtp.a12.dataservices.rpc.RpcException
import com.mgmtp.a12.scripting.shared.api.exceptions.SanitizedScriptFailure
import com.mgmtp.a12.scripting.shared.api.exceptions.ScriptExecutionException
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingRpcExceptionKeys.SCRIPT_EXECUTION_EXCEPTION
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingRpcExceptionKeys.SCRIPT_NOT_FOUND_EXCEPTION
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptFailureSanitizer
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import tools.jackson.databind.ObjectMapper

@ExtendWith(OutputCaptureExtension::class)
private class CallScriptOperationTest {
    val mockCallableScriptService = mockk<CallableScriptService>()

    // Subject under test
    val callScriptOperation = CallScriptOperation(
        mockCallableScriptService,
        ObjectMapper(),
        ScriptFailureSanitizer(ScriptingProperties(scriptLocations = listOf("file:/scripts"))),
    )

    companion object {
        const val SCRIPT_NAME = "someScriptName"
        const val SCRIPT_FILE_NAME = "someScript.js"
        const val SENSITIVE_ARGUMENT_VALUE = "someInputValue"
        const val CALL_SCRIPT_OPERATION_ID = "CALL_SCRIPT"
        const val UNREPORTED_FAILURE_LOG_LINE = "$CALL_SCRIPT_OPERATION_ID failed for script $SCRIPT_NAME"
        const val UNREPORTED_FAILURE_MESSAGE = "context could not be created"
        val arguments = mapOf("someInputKey" to SENSITIVE_ARGUMENT_VALUE)
    }

    @BeforeEach
    fun setup() {
        every { mockCallableScriptService.callScript(any(), any()) } returns emptyMap()
    }

    @Test
    fun `should successfully call script with valid input`() {
        // when
        callScriptOperation.rpc(SCRIPT_NAME, arguments)

        // then
        verify {
            mockCallableScriptService.callScript(SCRIPT_NAME, arguments)
        }
    }

    @Test
    fun `should complete without throwing any exception`() {
        // when/then
        shouldNotThrowAny {
            callScriptOperation.rpc(SCRIPT_NAME, arguments)
        }
    }

    @Test
    fun `should log the operation and the script name without the arguments`(capturedOutput: CapturedOutput) {
        // when
        callScriptOperation.rpc(SCRIPT_NAME, arguments)

        // then
        capturedOutput.all shouldContain SCRIPT_NAME
        capturedOutput.all shouldNotContain SENSITIVE_ARGUMENT_VALUE
    }

    @Nested
    inner class ScriptNotFound {

        @Test
        fun `should throw RpcException naming the operation and keeping the error key`() {
            // given
            every { mockCallableScriptService.callScript(SCRIPT_NAME, arguments) } throws NotFoundException("Not found")

            // when
            val thrown = shouldThrow<RpcException> {
                callScriptOperation.rpc(SCRIPT_NAME, arguments)
            }

            // then
            thrown.operationError.operationId shouldBe CALL_SCRIPT_OPERATION_ID
            thrown.operationError.shortMessage.key shouldBe "$SCRIPT_NOT_FOUND_EXCEPTION.title"
            thrown.operationError.shortMessage.defaultMessage shouldBe "Could not find script with name $SCRIPT_NAME"
            thrown.operationError.longMessage.key shouldBe "$SCRIPT_NOT_FOUND_EXCEPTION.description"
        }
    }

    @Nested
    inner class ScriptExecutionFailure {

        @Test
        fun `should surface the sanitized title and description of a script failure`() {
            // given
            val sanitizedFailure = SanitizedScriptFailure(
                scriptIdentifier = SCRIPT_FILE_NAME,
                failureCallSite = "$SCRIPT_FILE_NAME:6",
                causeText = "Error: script failed",
            )
            every {
                mockCallableScriptService.callScript(SCRIPT_NAME, arguments)
            } throws ScriptExecutionException(sanitizedFailure)

            // when
            val thrown = shouldThrow<RpcException> {
                callScriptOperation.rpc(SCRIPT_NAME, arguments)
            }

            // then
            thrown.operationError.operationId shouldBe CALL_SCRIPT_OPERATION_ID
            thrown.operationError.shortMessage.key shouldBe "$SCRIPT_EXECUTION_EXCEPTION.title"
            thrown.operationError.shortMessage.defaultMessage shouldBe "Script '$SCRIPT_FILE_NAME' failed at $SCRIPT_FILE_NAME:6"
            thrown.operationError.longMessage.defaultMessage shouldBe "Error: script failed"
        }

        @Test
        fun `should not name the arguments in title or description`() {
            // given
            every { mockCallableScriptService.callScript(SCRIPT_NAME, arguments) } throws RuntimeException("Execution failed")

            // when
            val thrown = shouldThrow<RpcException> {
                callScriptOperation.rpc(SCRIPT_NAME, arguments)
            }

            // then
            thrown.operationError.shortMessage.defaultMessage shouldNotContain SENSITIVE_ARGUMENT_VALUE
            thrown.operationError.longMessage.defaultMessage shouldNotContain SENSITIVE_ARGUMENT_VALUE
        }

        @Test
        fun `should log a warning for a failure that never passed through the reporter`(capturedOutput: CapturedOutput) {
            // given — the script never ran, so nothing logged this failure yet
            every { mockCallableScriptService.callScript(SCRIPT_NAME, arguments) } throws IllegalStateException(UNREPORTED_FAILURE_MESSAGE)

            // when
            shouldThrow<RpcException> {
                callScriptOperation.rpc(SCRIPT_NAME, arguments)
            }

            // then — the warning names the failure kind; its message may quote data, so only debug level carries it
            val warning = capturedOutput.all.lines().single { it.startsWith("WARN ") }
            warning shouldContain UNREPORTED_FAILURE_LOG_LINE
            warning shouldContain IllegalStateException::class.java.simpleName
            warning shouldNotContain UNREPORTED_FAILURE_MESSAGE
            val debugEntryWithStackTrace = capturedOutput.all.substringAfter("DEBUG CallScriptOperation - $UNREPORTED_FAILURE_LOG_LINE", missingDelimiterValue = "")
            debugEntryWithStackTrace shouldContain UNREPORTED_FAILURE_MESSAGE
        }

        @Test
        fun `should not log a failure the reporter already logged`(capturedOutput: CapturedOutput) {
            // given
            val sanitizedFailure = SanitizedScriptFailure(SCRIPT_FILE_NAME, failureCallSite = null, causeText = "Error: script failed")
            every {
                mockCallableScriptService.callScript(SCRIPT_NAME, arguments)
            } throws ScriptExecutionException(sanitizedFailure)

            // when
            shouldThrow<RpcException> {
                callScriptOperation.rpc(SCRIPT_NAME, arguments)
            }

            // then — a second entry for the same failure would duplicate what the reporter logged
            capturedOutput.all shouldNotContain UNREPORTED_FAILURE_LOG_LINE
        }

        @Test
        fun `should scrub script locations from a failure that carries no sanitized failure`() {
            // given — an exception from outside the reporter, so nothing has sanitized it yet
            every {
                mockCallableScriptService.callScript(SCRIPT_NAME, arguments)
            } throws RuntimeException("Failed at /opt/app/scripts/some-script.js:6:12")

            // when
            val thrown = shouldThrow<RpcException> {
                callScriptOperation.rpc(SCRIPT_NAME, arguments)
            }

            // then — the deployment did not opt into source locations, so neither path nor line survives
            thrown.operationError.operationId shouldBe CALL_SCRIPT_OPERATION_ID
            thrown.operationError.shortMessage.defaultMessage shouldBe "Script '$SCRIPT_NAME' failed"
            thrown.operationError.longMessage.defaultMessage shouldBe "Failed at some-script.js"
        }
    }

    @Nested
    inner class ResponseSerialization {

        @Test
        fun `should return empty JSON object when script returns empty map`() {
            // given
            every { mockCallableScriptService.callScript(any(), any()) } returns emptyMap()

            // when
            val result = callScriptOperation.rpc(SCRIPT_NAME, arguments)

            // then
            result shouldBe "{}"
        }

        @Test
        fun `should return JSON string when script returns non-empty map`() {
            // given
            every { mockCallableScriptService.callScript(any(), any()) } returns mapOf("greeting" to "Hello")

            // when
            val result = callScriptOperation.rpc(SCRIPT_NAME, arguments)

            // then
            result shouldBe """{"greeting":"Hello"}"""
        }
    }
}
