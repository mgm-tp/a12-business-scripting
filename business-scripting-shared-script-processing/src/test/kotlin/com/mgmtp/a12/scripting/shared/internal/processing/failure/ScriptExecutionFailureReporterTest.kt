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

package com.mgmtp.a12.scripting.shared.internal.processing.failure

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.mgmtp.a12.scripting.shared.api.exceptions.ScriptExecutionException
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.FAILING_TYPESCRIPT_LINE
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.PERSONAL_DATA_MARKER
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.SCRIPT_FILE_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.SCRIPT_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.SCRIPT_SOURCE_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.TYPESCRIPT_FILE_NAME
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.HostAccess
import org.graalvm.polyglot.PolyglotException
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private class ScriptExecutionFailureReporterTest {

    private val reporterLogger = LoggerFactory.getLogger(ScriptExecutionFailureReporter::class.java) as Logger
    private val reporterLogEvents = ListAppender<ILoggingEvent>()

    @BeforeEach
    fun captureReporterLogEventsDownToDebug() {
        reporterLogger.level = Level.DEBUG
        reporterLogEvents.start()
        reporterLogger.addAppender(reporterLogEvents)
    }

    @AfterEach
    fun releaseReporterLogEvents() {
        reporterLogger.detachAppender(reporterLogEvents)
        reporterLogger.level = null
    }

    private fun reporterLogEventsAt(level: Level) = reporterLogEvents.list.filter { it.level == level }

    companion object {
        private const val GUEST_ERROR_MESSAGE = "DocumentNotFoundError: Document not found"


        /** The script engine prefixes a thrown guest error with its own error name. */
        private const val SURFACED_CAUSE_TEXT = "Error: $GUEST_ERROR_MESSAGE"

        private const val FAILING_CALL_SITE = "$TYPESCRIPT_FILE_NAME:$FAILING_TYPESCRIPT_LINE"

        /** What a mapped A12 error shows the script, without the Data Services detail. */
        private const val MAPPED_ERROR_MESSAGE = "Data Services request failed."

        /** The original Data Services failure, which may quote personal data. */
        private const val DATA_SERVICES_FAILURE_DETAIL = "Field '/Project/Name' rejected '$PERSONAL_DATA_MARKER'"

        private const val SECONDS_UNTIL_EXECUTION_TIMES_OUT = 10L

        private val PLAIN_SCRIPT: ParsedScript = ParsedTestScripts.scriptWithoutFailure()

        private fun reporterWithSourceLocation(includeSourceLocation: Boolean) = ScriptExecutionFailureReporter(
            ScriptFailureSanitizer(
                ScriptingProperties(
                    scriptLocations = listOf("file:/scripts"),
                    errorMessages = ScriptingProperties.ErrorMessages(includeSourceLocation = includeSourceLocation),
                ),
            ),
        )

        /** Runs a failing script and reports the failure, with the GraalVM context still open. */
        private fun reportFailureOf(parsedScript: ParsedScript, includeSourceLocation: Boolean): ScriptExecutionException = Context.create("js").use { context ->
            shouldThrow<ScriptExecutionException> {
                reporterWithSourceLocation(includeSourceLocation)
                    .logAndRethrowSanitizingScriptFailures(parsedScript) { context.eval(parsedScript.source) }
            }
        }

        private fun reportFailureOfThrowingScript(includeSourceLocation: Boolean): ScriptExecutionException = reportFailureOf(ParsedTestScripts.throwingScriptWithInlineSourceMap(GUEST_ERROR_MESSAGE), includeSourceLocation)
    }

    @Nested
    inner class SuccessfulExecution {

        @Test
        fun `should return the script result and log nothing`() {
            // when
            val result = reporterWithSourceLocation(includeSourceLocation = false)
                .logAndRethrowSanitizingScriptFailures(PLAIN_SCRIPT) { "the result" }

            // then
            result shouldBe "the result"
            reporterLogEvents.list.shouldBeEmpty()
        }
    }

    @Nested
    inner class ScriptFailure {

        @Test
        fun `should surface the sanitized message and log only the failure kind at warn level`() {
            // when
            val surfaced = reportFailureOfThrowingScript(includeSourceLocation = true)

            // then — the caller sees the script file and the call site, no directory
            surfaced.message shouldBe "Script '$SCRIPT_FILE_NAME' failed at $FAILING_CALL_SITE caused by: $SURFACED_CAUSE_TEXT"
            surfaced.failure.failureCallSite shouldBe FAILING_CALL_SITE

            // and — the warning names the script and the failure kind, never the failure's message
            val warning = reporterLogEventsAt(Level.WARN).single()
            warning.formattedMessage shouldContain SCRIPT_NAME
            warning.formattedMessage shouldContain PolyglotException::class.java.simpleName
            warning.formattedMessage shouldNotContain GUEST_ERROR_MESSAGE
            warning.throwableProxy.shouldBeNull()
        }

        @Test
        fun `should log the original failure at debug level only`() {
            // when
            reportFailureOfThrowingScript(includeSourceLocation = true)

            // then
            val debugEntry = reporterLogEventsAt(Level.DEBUG).single()
            debugEntry.formattedMessage shouldContain SCRIPT_NAME
            debugEntry.throwableProxy.className shouldBe PolyglotException::class.java.name
            debugEntry.throwableProxy.message shouldContain GUEST_ERROR_MESSAGE
        }

        @Test
        fun `should log the cause of a mapped error at debug level only`() {
            // given — a mapped A12 error keeps the original Data Services failure only as its JavaScript cause
            val dataServicesFailure = IllegalStateException(DATA_SERVICES_FAILURE_DETAIL)
            val parsedScript = ParsedTestScripts.parsedScriptOf(
                ParsedTestScripts.sourceOf("throw new Error('$MAPPED_ERROR_MESSAGE', { cause: dataServicesFailure });"),
            )

            // when
            Context.newBuilder("js").allowHostAccess(HostAccess.ALL).build().use { context ->
                context.getBindings("js").putMember("dataServicesFailure", dataServicesFailure)
                shouldThrow<ScriptExecutionException> {
                    reporterWithSourceLocation(includeSourceLocation = true)
                        .logAndRethrowSanitizingScriptFailures(parsedScript) { context.eval(parsedScript.source) }
                }
            }

            // then
            val causeEntry = reporterLogEventsAt(Level.DEBUG).single { it.throwableProxy?.className == IllegalStateException::class.java.name }
            causeEntry.formattedMessage shouldContain SCRIPT_NAME
            causeEntry.throwableProxy.message shouldBe DATA_SERVICES_FAILURE_DETAIL
            reporterLogEventsAt(Level.WARN).single().formattedMessage shouldNotContain PERSONAL_DATA_MARKER
        }

        @Test
        fun `should surface the sanitized failure when its cause cannot be read`() {
            // given — reading this cause runs a getter that throws a message quoting personal data
            val parsedScript = ParsedTestScripts.parsedScriptOf(
                ParsedTestScripts.sourceOf(
                    "const failure = new Error('$MAPPED_ERROR_MESSAGE');" +
                        "Object.defineProperty(failure, 'cause', { get() { throw new Error('$PERSONAL_DATA_MARKER'); } });" +
                        "throw failure;",
                ),
            )

            // when
            val surfaced = reportFailureOf(parsedScript, includeSourceLocation = true)

            // then
            surfaced.message shouldContain MAPPED_ERROR_MESSAGE
            surfaced.message shouldNotContain PERSONAL_DATA_MARKER
        }

        @Test
        fun `should not carry the original failure as the cause`() {
            // when
            val surfaced = reportFailureOfThrowingScript(includeSourceLocation = true)

            // then — a host such as the workflow engine logs and stores the whole cause chain
            surfaced.cause.shouldBeNull()
        }

        @Test
        fun `should surface no call site when the deployment does not expose source locations`() {
            // when
            val surfaced = reportFailureOfThrowingScript(includeSourceLocation = false)

            // then
            surfaced.failure.failureCallSite.shouldBeNull()
            surfaced.message shouldBe "Script '$SCRIPT_FILE_NAME' failed caused by: $SURFACED_CAUSE_TEXT"
        }

        @Test
        fun `should log the rejected class name at debug level only and surface none of it`() {
            // given
            val parsedScript = ParsedTestScripts.parsedScriptOf(scriptLookingUpADeniedHostClass(SCRIPT_SOURCE_NAME))

            // when
            val surfaced = contextDenyingHostClassLookup().use { context ->
                shouldThrow<ScriptExecutionException> {
                    reporterWithSourceLocation(includeSourceLocation = true)
                        .logAndRethrowSanitizingScriptFailures(parsedScript) { context.eval(parsedScript.source) }
                }
            }

            // then — on a system with debug logging, the operator can tell which class was rejected
            reporterLogEventsAt(Level.DEBUG).single().throwableProxy.message shouldContain DENIED_HOST_CLASS_NAME
            reporterLogEventsAt(Level.WARN).single().formattedMessage shouldNotContain DENIED_HOST_CLASS_NAME

            // and — the caller learns only that the scripting API is the way in
            surfaced.message shouldContain HOST_CLASS_LOOKUP_API_GUIDANCE
            surfaced.message shouldNotContain DENIED_HOST_CLASS_NAME
        }

        @Test
        fun `should wrap a failure that did not come from the script engine`() {
            // when
            val surfaced = shouldThrow<ScriptExecutionException> {
                reporterWithSourceLocation(includeSourceLocation = true)
                    .logAndRethrowSanitizingScriptFailures(PLAIN_SCRIPT) {
                        throw IllegalStateException("Return value 'greeting' not found in the script result.")
                    }
            }

            // then
            surfaced.message shouldBe "Script '$SCRIPT_FILE_NAME' failed caused by: Return value 'greeting' not found in the script result."
        }
    }

    @Nested
    inner class InfrastructureFailure {

        @Test
        fun `should log and rethrow an Error unchanged`() {
            // given — a runaway script exhausts the stack; that is not a script defect to report as one
            val stackOverflow = StackOverflowError("too deep")

            // when
            val thrown = shouldThrow<StackOverflowError> {
                reporterWithSourceLocation(includeSourceLocation = true)
                    .logAndRethrowSanitizingScriptFailures(PLAIN_SCRIPT) { throw stackOverflow }
            }

            // then
            thrown shouldBe stackOverflow
            reporterLogEventsAt(Level.DEBUG).single().throwableProxy.message shouldBe "too deep"
        }

        @Test
        fun `should name the failure kind but not its message at warn level`() {
            // when
            shouldThrow<InfrastructureError> {
                reporterWithSourceLocation(includeSourceLocation = true)
                    .logAndRethrowSanitizingScriptFailures(PLAIN_SCRIPT) { throw InfrastructureError(PERSONAL_DATA_MARKER) }
            }

            // then
            val warning = reporterLogEventsAt(Level.WARN).single()
            warning.formattedMessage shouldContain SCRIPT_NAME
            warning.formattedMessage shouldContain InfrastructureError::class.java.simpleName
            warning.formattedMessage shouldNotContain PERSONAL_DATA_MARKER
            warning.throwableProxy.shouldBeNull()
        }

        @Test
        fun `should log and rethrow a cancelled polyglot exception unchanged`() {
            // given — an endless script. GraalVM cancels a context only from a thread other than the
            // one executing it, so the script runs on a worker and signals when it has started.
            val scriptEntered = CountDownLatch(1)
            val context = Context.newBuilder("js").allowHostAccess(HostAccess.ALL).build()
            context.getBindings("js").putMember("signalScriptEntered", Runnable { scriptEntered.countDown() })
            val endlessScript = ParsedTestScripts.parsedScriptOf(ParsedTestScripts.sourceOf("signalScriptEntered.run(); while (true) {}"))
            val reporter = reporterWithSourceLocation(includeSourceLocation = true)
            val executor = Executors.newSingleThreadExecutor()

            try {
                // when
                val execution = executor.submit<Any> {
                    reporter.logAndRethrowSanitizingScriptFailures(endlessScript) { context.eval(endlessScript.source) }
                }
                scriptEntered.await(SECONDS_UNTIL_EXECUTION_TIMES_OUT, TimeUnit.SECONDS) shouldBe true
                context.close(true)

                // then — wrapping a cancellation can interfere with the teardown that caused it
                val failedExecution = shouldThrow<ExecutionException> {
                    execution.get(SECONDS_UNTIL_EXECUTION_TIMES_OUT, TimeUnit.SECONDS)
                }
                failedExecution.cause.shouldBeInstanceOf<PolyglotException>().isCancelled shouldBe true
                reporterLogEventsAt(Level.WARN).single().formattedMessage shouldContain SCRIPT_NAME
            } finally {
                executor.shutdownNow()
            }
        }
    }
}

/** Any `Error` the script engine raises, e.g. for a runaway script. */
private class InfrastructureError(message: String) : Error(message)
