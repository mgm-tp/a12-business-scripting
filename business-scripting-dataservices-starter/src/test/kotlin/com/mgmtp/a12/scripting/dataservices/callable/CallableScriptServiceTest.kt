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
import com.mgmtp.a12.dataservices.document.DocumentService
import com.mgmtp.a12.dataservices.document.internal.kernel.KernelDocumentService
import com.mgmtp.a12.dataservices.query.QueryService
import com.mgmtp.a12.dataservices.relationship.RelationshipLinkService
import com.mgmtp.a12.dataservices.relationship.validation.RelationshipValidationSupport
import com.mgmtp.a12.kernel.md.model.api.services.IDocumentModelResolver
import com.mgmtp.a12.scripting.dataservices.callable.api.events.execution.BusinessScriptAfterExecuteEvent
import com.mgmtp.a12.scripting.dataservices.callable.api.events.execution.BusinessScriptBeforeExecuteEvent
import com.mgmtp.a12.scripting.shared.api.exceptions.BusinessScriptExecutionVetoException
import com.mgmtp.a12.scripting.shared.api.exceptions.ScriptExecutionException
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptInvoker
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverter
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.context.ScriptLocationIoAccessProvider
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptRegistry
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptExecutionFailureReporter
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptFailureSanitizer
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import io.mockk.verifyOrder
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.Source
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.context.ApplicationEvent
import org.springframework.context.ApplicationEventPublisher
import kotlin.time.Clock

private class CallableScriptServiceTest {

    companion object {
        const val SCRIPT_NAME = "someScriptName"
        const val SCRIPT_FILE_NAME = "test.js"
        const val GUEST_ERROR_MESSAGE = "script failed"
        val ARGUMENTS = mapOf("someInputKey" to "someInputValue")

        val HAPPY_SOURCE: Source = Source
            .newBuilder("js", "function execute() {}; export { execute };", SCRIPT_FILE_NAME)
            .mimeType("application/javascript+module")
            .build()
        val THROWING_SOURCE: Source = Source
            .newBuilder("js", "function execute() { throw new Error('$GUEST_ERROR_MESSAGE'); }; export { execute };", SCRIPT_FILE_NAME)
            .mimeType("application/javascript+module")
            .build()

        fun parsedScriptOf(source: Source) = ParsedScript(
            source = source,
            scriptFileName = SCRIPT_FILE_NAME,
            scriptIdentifier = SCRIPT_NAME,
            params = emptyMap(),
            returnProperties = emptyMap(),
            lastParsed = Clock.System.now(),
        )
    }

    val engine: Engine = Engine.create("js")

    // Test sources declare no imports, so the scripts run without IO access
    val jsContextFactory = JsContextFactory(engine, emptyList(), ScriptLocationIoAccessProvider(emptyList()))

    val mockScriptRegistry = mockk<ScriptRegistry>()
    val mockDocumentService = mockk<DocumentService>()
    val mockQueryService = mockk<QueryService>()
    val mockRelationshipLinkService = mockk<RelationshipLinkService>()
    val mockRelationshipValidationSupport = mockk<RelationshipValidationSupport>()
    val mockKernelDocumentService = mockk<KernelDocumentService>()
    val mockDocumentModelResolver = mockk<IDocumentModelResolver>()
    val parsedScript = parsedScriptOf(HAPPY_SOURCE)
    val mockEventPublisher = mockk<ApplicationEventPublisher>(relaxed = true)

    val callableScriptService = CallableScriptService(
        mockScriptRegistry,
        mockDocumentService,
        mockQueryService,
        mockRelationshipLinkService,
        mockRelationshipValidationSupport,
        mockKernelDocumentService,
        mockEventPublisher,
        jsContextFactory,
        mockDocumentModelResolver,
        ScriptInvoker(ScriptTypeConverter()),
        ScriptExecutionFailureReporter(ScriptFailureSanitizer(ScriptingProperties(scriptLocations = listOf("file:/scripts")))),
    )

    @BeforeEach
    fun setup() {
        every { mockScriptRegistry.get(SCRIPT_NAME) } returns parsedScript
    }

    private fun capturePublishedEvents(): List<ApplicationEvent> {
        val capturedEvents = mutableListOf<ApplicationEvent>()
        verify(atLeast = 1) { mockEventPublisher.publishEvent(capture(capturedEvents)) }
        return capturedEvents
    }

    @Nested
    inner class CallScript {

        @Test
        fun `should invoke script function when script is called`() {
            // when
            callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)

            // then — both lifecycle events published proves the script ran to completion
            verify { mockEventPublisher.publishEvent(ofType<BusinessScriptBeforeExecuteEvent>()) }
            verify { mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>()) }
        }

        @Test
        fun `should complete without throwing any exception`() {
            // when/then
            shouldNotThrowAny {
                callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
            }
        }

        @Test
        fun `should surface a sanitized failure naming the script file when the script throws`() {
            // given
            every { mockScriptRegistry.get(SCRIPT_NAME) } returns parsedScriptOf(THROWING_SOURCE)

            // when
            val thrown = shouldThrow<ScriptExecutionException> {
                callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
            }

            // then — no source location, since a deployment that configures nothing does not expose it
            thrown.message shouldBe "Script '$SCRIPT_FILE_NAME' failed caused by: Error: $GUEST_ERROR_MESSAGE"
        }

        @Test
        fun `should throw NotFoundException when script was not found`() {
            // given
            every { mockScriptRegistry.get(SCRIPT_NAME) } returns null

            // when/then
            shouldThrow<NotFoundException> {
                callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
            }
        }
    }

    @Nested
    inner class ExecutionHooks {

        @Nested
        inner class BeforeEvent {

            @Test
            fun `should publish before-event with correct data before script execution`() {
                // when
                callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)

                // then
                val events = capturePublishedEvents()
                val beforeEvent = events.filterIsInstance<BusinessScriptBeforeExecuteEvent>().single()
                beforeEvent.scriptUri shouldBe HAPPY_SOURCE.uri
                beforeEvent.scriptName shouldBe SCRIPT_NAME
                beforeEvent.arguments shouldBe ARGUMENTS
            }

            @Test
            fun `should publish before-event before after-event`() {
                // when
                callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)

                // then
                verifyOrder {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptBeforeExecuteEvent>())
                    mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>())
                }
            }
        }

        @Nested
        inner class AfterEvent {

            @Test
            fun `should publish after-event with correct data after successful execution`() {
                // when
                callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)

                // then
                val events = capturePublishedEvents()
                val afterEvent = events.filterIsInstance<BusinessScriptAfterExecuteEvent>().single()
                afterEvent.scriptUri shouldBe HAPPY_SOURCE.uri
                afterEvent.scriptName shouldBe SCRIPT_NAME
                afterEvent.arguments shouldBe ARGUMENTS
                afterEvent.exception.shouldBeNull()
            }

            @Test
            fun `should publish after-event with exception when script throws`() {
                // given
                every { mockScriptRegistry.get(SCRIPT_NAME) } returns parsedScriptOf(THROWING_SOURCE)

                // when
                val thrown = shouldThrow<RuntimeException> {
                    callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
                }

                // then
                thrown.shouldBeInstanceOf<ScriptExecutionException>()
                val events = capturePublishedEvents()
                val afterEvent = events.filterIsInstance<BusinessScriptAfterExecuteEvent>().single()
                afterEvent.exception shouldBe thrown
            }
        }

        @Nested
        inner class VetoMechanism {

            @Test
            fun `should prevent script execution when before-listener throws veto exception`() {
                // given
                every {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptBeforeExecuteEvent>())
                } throws BusinessScriptExecutionVetoException("vetoed")

                // when
                shouldThrow<BusinessScriptExecutionVetoException> {
                    callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
                }

                // then — absence of after-event proves the script body was not reached
                verify(exactly = 0) {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>())
                }
            }
        }

        @Nested
        inner class ExceptionPrecedence {

            @Test
            fun `should prioritize script exception over after-listener exception`() {
                // given
                every { mockScriptRegistry.get(SCRIPT_NAME) } returns parsedScriptOf(THROWING_SOURCE)
                val listenerError = RuntimeException("listener failed")
                every {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>())
                } throws listenerError

                // when
                val thrown = shouldThrow<RuntimeException> {
                    callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
                }

                // then
                thrown.shouldBeInstanceOf<ScriptExecutionException>()
                thrown.suppressed.first() shouldBe listenerError
            }

            @Test
            fun `should propagate after-listener exception when script succeeds`() {
                // given
                val listenerError = RuntimeException("listener failed")
                every {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>())
                } throws listenerError

                // when
                val thrown = shouldThrow<RuntimeException> {
                    callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
                }

                // then
                thrown shouldBe listenerError
            }
        }

        @Nested
        inner class NoListeners {

            @Test
            fun `should execute script normally when no listeners are registered`() {
                // when/then
                shouldNotThrowAny {
                    callableScriptService.callScript(SCRIPT_NAME, ARGUMENTS)
                }
            }
        }
    }
}
