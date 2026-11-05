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

import com.mgmtp.a12.scripting.shared.api.exceptions.SanitizedScriptFailure
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.FAILING_TYPESCRIPT_LINE
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.SCRIPT_FILE_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.SCRIPT_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.SCRIPT_SOURCE_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.TYPESCRIPT_FILE_NAME
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.TYPESCRIPT_SOURCE_PATH
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.PolyglotException
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

private class ScriptFailureSanitizerTest {

    companion object {
        private const val GUEST_ERROR_MESSAGE = "Document lookup failed at $TYPESCRIPT_SOURCE_PATH:$FAILING_TYPESCRIPT_LINE"
        private const val FAILING_CALL_SITE = "$TYPESCRIPT_FILE_NAME:$FAILING_TYPESCRIPT_LINE"

        private fun sanitizerWithSourceLocation(includeSourceLocation: Boolean) = ScriptFailureSanitizer(
            ScriptingProperties(
                scriptLocations = listOf("file:/scripts"),
                errorMessages = ScriptingProperties.ErrorMessages(includeSourceLocation = includeSourceLocation),
            ),
        )

        /**
         * Runs a failing script and sanitizes the resulting failure. The GraalVM context stays open,
         * because resolving the call site reads context-bound state.
         */
        private fun sanitizeFailureOf(parsedScript: ParsedScript, includeSourceLocation: Boolean): SanitizedScriptFailure = Context.create("js").use { context ->
            val polyglotException = shouldThrow<PolyglotException> { context.eval(parsedScript.source) }
            sanitizerWithSourceLocation(includeSourceLocation).sanitizeScriptFailure(parsedScript, polyglotException)
        }
    }

    @Nested
    inner class WithSourceLocationIncluded {

        @Test
        fun `should name the call site and keep the line in the cause text`() {
            // when
            val failure = sanitizeFailureOf(
                ParsedTestScripts.throwingScriptWithInlineSourceMap(GUEST_ERROR_MESSAGE),
                includeSourceLocation = true,
            )

            // then
            failure.scriptIdentifier shouldBe SCRIPT_FILE_NAME
            failure.failureCallSite shouldBe FAILING_CALL_SITE
            failure.causeText shouldContain FAILING_CALL_SITE
        }

        @Test
        fun `should remove the directory from the source path in the cause text`() {
            // when
            val failure = sanitizeFailureOf(
                ParsedTestScripts.throwingScriptWithInlineSourceMap(GUEST_ERROR_MESSAGE),
                includeSourceLocation = true,
            )

            // then
            failure.causeText shouldNotContain "system-test-scripts"
            failure.description shouldNotContain "/"
        }

        @Test
        fun `should name no call site for a script built without a source map`() {
            // when
            val failure = sanitizeFailureOf(
                ParsedTestScripts.throwingScriptWithoutSourceMap(GUEST_ERROR_MESSAGE),
                includeSourceLocation = true,
            )

            // then — without a map the generated line cannot be traced back to the TypeScript source
            failure.scriptIdentifier shouldBe SCRIPT_FILE_NAME
            failure.failureCallSite.shouldBeNull()
        }

        @Test
        fun `should name no call site when the source map holds no mapping for the failing line`() {
            // when
            val failure = sanitizeFailureOf(
                ParsedTestScripts.throwingScriptWithUnmappedFailingLine(GUEST_ERROR_MESSAGE),
                includeSourceLocation = true,
            )

            // then
            failure.failureCallSite.shouldBeNull()
        }
    }

    @Nested
    inner class WithSourceLocationExcluded {

        @Test
        fun `should omit the call site and drop the line from the cause text`() {
            // when
            val failure = sanitizeFailureOf(
                ParsedTestScripts.throwingScriptWithInlineSourceMap(GUEST_ERROR_MESSAGE),
                includeSourceLocation = false,
            )

            // then
            failure.scriptIdentifier shouldBe SCRIPT_FILE_NAME
            failure.failureCallSite.shouldBeNull()
            failure.causeText shouldContain TYPESCRIPT_FILE_NAME
            failure.causeText shouldNotContain FAILING_CALL_SITE
            failure.description shouldNotContain "/"
        }
    }

    @Nested
    inner class DeniedHostClassLookupFailure {

        private fun sanitizeDeniedLookup(includeSourceLocation: Boolean): SanitizedScriptFailure {
            val parsedScript = ParsedTestScripts.parsedScriptOf(scriptLookingUpADeniedHostClass(SCRIPT_SOURCE_NAME))
            return contextDenyingHostClassLookup().use { context ->
                val polyglotException = shouldThrow<PolyglotException> { context.eval(parsedScript.source) }
                sanitizerWithSourceLocation(includeSourceLocation).sanitizeScriptFailure(parsedScript, polyglotException)
            }
        }

        @Test
        fun `should surface the api guidance instead of the rejected class when source locations are included`() {
            // when
            val failure = sanitizeDeniedLookup(includeSourceLocation = true)

            // then
            failure.causeText shouldBe "TypeError: $HOST_CLASS_LOOKUP_API_GUIDANCE"
            failure.description shouldNotContain DENIED_HOST_CLASS_NAME
            failure.description shouldNotContain "/"
        }

        @Test
        fun `should surface the api guidance instead of the rejected class when source locations are excluded`() {
            // when — the switch selects which scrubbing rules run, so both settings need pinning
            val failure = sanitizeDeniedLookup(includeSourceLocation = false)

            // then
            failure.causeText shouldBe "TypeError: $HOST_CLASS_LOOKUP_API_GUIDANCE"
            failure.description shouldNotContain DENIED_HOST_CLASS_NAME
            failure.description shouldNotContain "/"
        }
    }

    @Nested
    inner class FailuresOutsideTheScriptEngine {

        @Test
        fun `should carry the cause message and no call site`() {
            // given — a script result validation failure, not a polyglot exception
            val cause = IllegalStateException("Return value 'greeting' not found in the script result.")

            // when
            val failure = sanitizerWithSourceLocation(includeSourceLocation = true)
                .sanitizeScriptFailure(ParsedTestScripts.scriptWithoutFailure(), cause)

            // then
            failure.scriptIdentifier shouldBe SCRIPT_FILE_NAME
            failure.failureCallSite.shouldBeNull()
            failure.causeText shouldBe "Return value 'greeting' not found in the script result."
        }

        @Test
        fun `should fall back to the script name when the source names no script file`() {
            // given
            val parsedScript = ParsedTestScripts.parsedScriptOf(
                ParsedTestScripts.sourceOf("export const execute = () => {};", sourceName = "Unnamed"),
            )

            // when
            val failure = sanitizerWithSourceLocation(includeSourceLocation = true)
                .sanitizeScriptFailure(parsedScript, IllegalStateException("failed"))

            // then
            failure.scriptIdentifier shouldBe SCRIPT_NAME
        }

        @Test
        fun `should name the failure type when the cause has no message`() {
            // when — a message-less cause must not surface as "null"
            val failure = sanitizerWithSourceLocation(includeSourceLocation = true)
                .sanitizeScriptFailure(ParsedTestScripts.scriptWithoutFailure(), NullPointerException())

            // then
            failure.causeText shouldBe "NullPointerException"
        }
    }
}
