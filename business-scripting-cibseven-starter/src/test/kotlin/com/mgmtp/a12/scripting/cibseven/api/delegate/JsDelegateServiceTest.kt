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

package com.mgmtp.a12.scripting.cibseven.api.delegate

import com.mgmtp.a12.scripting.cibseven.api.events.execution.BusinessScriptAfterExecuteEvent
import com.mgmtp.a12.scripting.cibseven.api.events.execution.BusinessScriptBeforeExecuteEvent
import com.mgmtp.a12.scripting.rpcFacade.internal.DataServicesRpcFacade
import com.mgmtp.a12.scripting.shared.api.exceptions.BusinessScriptExecutionVetoException
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptInvoker
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptRegistry
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptExecutionFailureReporter
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptFailureSanitizer
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import io.mockk.verifyOrder
import org.cibseven.bpm.engine.delegate.DelegateExecution
import org.cibseven.bpm.engine.delegate.JavaDelegate
import org.junit.jupiter.api.*
import org.springframework.context.ApplicationEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.web.context.support.GenericWebApplicationContext
import java.net.URL
import java.util.function.Supplier

private class JsDelegateServiceTest {
    val mockScriptRegistry = mockk<ScriptRegistry>()
    val mockJsContextFactory = mockk<JsContextFactory>()
    val mockScriptInvoker = mockk<ScriptInvoker>()
    val mockContext = mockk<GenericWebApplicationContext>(relaxed = true)
    val mockDataServicesRpcFacade = mockk<DataServicesRpcFacade>(relaxed = true)
    val mockEventPublisher = mockk<ApplicationEventPublisher>(relaxed = true)

    val jsDelegateService: JsDelegateService = JsDelegateService(
        scriptRegistry = mockScriptRegistry,
        applicationContext = mockContext,
        dataServicesRpcFacade = mockDataServicesRpcFacade,
        eventPublisher = mockEventPublisher,
        jsContextFactory = mockJsContextFactory,
        scriptInvoker = mockScriptInvoker,
        scriptExecutionFailureReporter = ScriptExecutionFailureReporter(
            ScriptFailureSanitizer(ScriptingProperties(scriptLocations = listOf("file:$SCRIPTS_DIRECTORY"))),
        ),
    )

    companion object {
        const val DELEGATE_NAME = "testDelegate"
        const val SCRIPTS_DIRECTORY = "/scripts"
        val SCRIPT_URL = mockk<URL>()
    }

    @Nested
    inner class ScriptDelegateRegistration {

        @BeforeEach
        fun setUp() {
            every { mockScriptRegistry.register(SCRIPT_URL) } returns DELEGATE_NAME
        }

        @Test
        fun `should register script as Spring bean with the script identifier`() {
            // when
            val result = jsDelegateService.registerScriptAsDelegate(SCRIPT_URL)

            // then
            result shouldBe DELEGATE_NAME
            verify {
                mockContext.registerBean(
                    eq(DELEGATE_NAME),
                    eq(JavaDelegate::class.java),
                    any<Supplier<JavaDelegate>>(),
                )
            }
        }
    }

    @Nested
    inner class ExecutionHooks {

        val mockDelegateExecution = mockk<DelegateExecution>()
        val mockExecuteScript: () -> Unit = mockk()

        @BeforeEach
        fun setup() {
            every { mockExecuteScript() } returns Unit
        }

        @Nested
        inner class BeforeEvent {

            @Test
            fun `should publish before-event with correct data before script execution`() {
                // when
                jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)

                // then
                val events = capturePublishedEvents()
                val beforeEvent = events.filterIsInstance<BusinessScriptBeforeExecuteEvent>().single()
                beforeEvent.scriptUrl shouldBe SCRIPT_URL
                beforeEvent.delegateName shouldBe DELEGATE_NAME
                beforeEvent.delegateExecution shouldBe mockDelegateExecution
            }

            @Test
            fun `should publish before-event before executing the script`() {
                // when
                jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)

                // then
                verifyOrder {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptBeforeExecuteEvent>())
                    mockExecuteScript()
                }
            }
        }

        @Nested
        inner class AfterEvent {

            @Test
            fun `should publish after-event with correct data after successful execution`() {
                // when
                jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)

                // then
                val events = capturePublishedEvents()
                val afterEvent = events.filterIsInstance<BusinessScriptAfterExecuteEvent>().single()
                afterEvent.scriptUrl shouldBe SCRIPT_URL
                afterEvent.delegateName shouldBe DELEGATE_NAME
                afterEvent.delegateExecution shouldBe mockDelegateExecution
                afterEvent.exception.shouldBeNull()
            }

            @Test
            fun `should publish after-event after executing the script`() {
                // when
                jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)

                // then
                verifyOrder {
                    mockExecuteScript()
                    mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>())
                }
            }

            @Test
            fun `should publish after-event with exception when script throws`() {
                // given
                val scriptError = RuntimeException("script failed")
                every { mockExecuteScript() } throws scriptError

                // when
                val thrown = shouldThrow<RuntimeException> {
                    jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)
                }

                // then
                thrown shouldBe scriptError
                val events = capturePublishedEvents()
                val afterEvent = events.filterIsInstance<BusinessScriptAfterExecuteEvent>().single()
                afterEvent.exception shouldBe scriptError
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

                // when/then
                shouldThrow<BusinessScriptExecutionVetoException> {
                    jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)
                }
                verify(exactly = 0) { mockExecuteScript() }
            }

            @Test
            fun `should not publish after-event when execution is vetoed`() {
                // given
                every {
                    mockEventPublisher.publishEvent(ofType<BusinessScriptBeforeExecuteEvent>())
                } throws BusinessScriptExecutionVetoException("vetoed")

                // when
                shouldThrow<BusinessScriptExecutionVetoException> {
                    jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)
                }

                // then
                verify(exactly = 0) { mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>()) }
            }
        }

        @Nested
        inner class ExceptionPrecedence {

            @Test
            fun `should prioritize script exception over after-listener exception`() {
                // given
                val scriptError = RuntimeException("script failed")
                val listenerError = RuntimeException("listener failed")
                every { mockExecuteScript() } throws scriptError
                every { mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>()) } throws listenerError

                // when
                val thrown = shouldThrow<RuntimeException> {
                    jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)
                }

                // then
                thrown shouldBe scriptError
                thrown.suppressed.first() shouldBe listenerError
            }

            @Test
            fun `should propagate after-listener exception when script succeeds`() {
                // given
                val listenerError = RuntimeException("listener failed")
                every { mockEventPublisher.publishEvent(ofType<BusinessScriptAfterExecuteEvent>()) } throws listenerError

                // when
                val thrown = shouldThrow<RuntimeException> {
                    jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)
                }

                // then
                thrown shouldBe listenerError
            }
        }

        @Nested
        inner class NoListeners {

            @Test
            fun `should execute script normally when no listeners are registered`() {
                // when
                jsDelegateService.executeWithHooks(SCRIPT_URL, DELEGATE_NAME, mockDelegateExecution, mockExecuteScript)

                // then
                verify(exactly = 1) { mockExecuteScript() }
            }
        }
    }

    private fun capturePublishedEvents(): List<ApplicationEvent> {
        val capturedEvents = mutableListOf<ApplicationEvent>()
        verify(atLeast = 1) { mockEventPublisher.publishEvent(capture(capturedEvents)) }
        return capturedEvents
    }
}
