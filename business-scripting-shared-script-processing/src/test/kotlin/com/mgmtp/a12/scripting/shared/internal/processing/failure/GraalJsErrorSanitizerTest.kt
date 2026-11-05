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

import com.mgmtp.a12.scripting.shared.internal.processing.failure.ParsedTestScripts.PERSONAL_DATA_MARKER
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.PolyglotException
import org.junit.jupiter.api.Test

private class GraalJsErrorSanitizerTest {

    companion object {
        private const val SOURCE_NAME = "lookup.js"
        private const val REJECTION = "Access to host class $DENIED_HOST_CLASS_NAME is not allowed or does not exist."
    }

    @Test
    fun `should reduce a runtime SyntaxError that quotes script data to its name`() {
        // given — the real engine error, which GraalJS flags as a syntax error although the script parsed fine
        val runtimeSyntaxError = Context.create("js").use { context ->
            shouldThrow<PolyglotException> { context.eval("js", "BigInt('$PERSONAL_DATA_MARKER')") }
        }

        // when
        val sanitized = sanitizeGraalJsErrorMessage(runtimeSyntaxError, runtimeSyntaxError.message.orEmpty())

        // then
        sanitized shouldBe "SyntaxError"
        sanitized shouldNotContain PERSONAL_DATA_MARKER
    }

    @Test
    fun `should replace the rejection GraalJS actually produces and drop the rejected class name`() {
        // given — the real message, so a js-language upgrade that rewords it turns this test red
        val source = scriptLookingUpADeniedHostClass(SOURCE_NAME)
        val rejection = contextDenyingHostClassLookup().use { context ->
            shouldThrow<PolyglotException> { context.eval(source) }
        }

        // when
        val guidance = sanitizeGraalJsErrorMessage(rejection, rejection.message.orEmpty())

        // then
        guidance shouldBe "TypeError: $HOST_CLASS_LOOKUP_API_GUIDANCE"
        guidance shouldNotContain DENIED_HOST_CLASS_NAME
    }

    @Test
    fun `should preserve the text surrounding the rejection`() {
        val text = "TypeError: $REJECTION at line 3"

        sanitizeGraalJsErrorMessage(IllegalStateException(text), text) shouldBe "TypeError: $HOST_CLASS_LOOKUP_API_GUIDANCE at line 3"
    }

    @Test
    fun `should leave text without a rejection untouched`() {
        val unrelatedFailure = "Error: Document 'Project_DM/2' not found"

        sanitizeGraalJsErrorMessage(IllegalStateException(unrelatedFailure), unrelatedFailure) shouldBe unrelatedFailure
    }
}
