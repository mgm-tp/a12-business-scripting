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

package com.mgmtp.a12.scripting.shared.api.exceptions

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

private class SanitizedScriptFailureTest {

    companion object {
        private const val SCRIPT_FILE_NAME = "doc-not-found.js"
        private const val FAILURE_CALL_SITE = "doc-not-found.ts:6"
        private const val CAUSE_TEXT = "DocumentNotFoundError: Document 'Project_DM/123' not found."
    }

    @Test
    fun `should name the failing line in the title when there is one`() {
        // given
        val failure = SanitizedScriptFailure(SCRIPT_FILE_NAME, FAILURE_CALL_SITE, CAUSE_TEXT)

        // then
        failure.title shouldBe "Script 'doc-not-found.js' failed at doc-not-found.ts:6"
        failure.description shouldBe CAUSE_TEXT
        failure.singleLineMessage shouldBe
            "Script 'doc-not-found.js' failed at doc-not-found.ts:6 caused by: $CAUSE_TEXT"
    }

    @Test
    fun `should name the script alone in the title when there is no call site`() {
        // given
        val failure = SanitizedScriptFailure(SCRIPT_FILE_NAME, failureCallSite = null, causeText = CAUSE_TEXT)

        // then
        failure.title shouldBe "Script 'doc-not-found.js' failed"
        failure.description shouldBe CAUSE_TEXT
        failure.singleLineMessage shouldBe "Script 'doc-not-found.js' failed caused by: $CAUSE_TEXT"
    }

    @Test
    fun `should chain one caused-by link per nesting level when a script call failed`() {
        // given — the inner script's message is what the outer script's failure reports as its cause
        val innerFailure = SanitizedScriptFailure("price-lookup.js", "price-lookup.ts:9", CAUSE_TEXT)
        val outerFailure = SanitizedScriptFailure(
            scriptIdentifier = "order-check.js",
            failureCallSite = "order-check.ts:4",
            causeText = "ScriptExecutionError: ${innerFailure.singleLineMessage}",
        )

        // then
        outerFailure.singleLineMessage shouldBe
            "Script 'order-check.js' failed at order-check.ts:4 caused by: " +
            "ScriptExecutionError: Script 'price-lookup.js' failed at price-lookup.ts:9 caused by: $CAUSE_TEXT"
    }
}
