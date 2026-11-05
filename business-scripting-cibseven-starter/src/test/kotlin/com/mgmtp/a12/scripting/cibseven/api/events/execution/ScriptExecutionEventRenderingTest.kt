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

package com.mgmtp.a12.scripting.cibseven.api.events.execution

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotInclude
import io.mockk.mockk
import org.cibseven.bpm.engine.delegate.DelegateExecution
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.net.URL

/**
 * A listener that logs an event it received is the expected way to leak process variables or the
 * script's location on the server, so the events render nothing but the delegate and the failure
 * type. The rendering is asserted in full because that is what keeps the process variables — whose
 * rendering would otherwise be up to [DelegateExecution.toString] — out of it.
 */
private class ScriptExecutionEventRenderingTest {

    companion object {
        const val DELEGATE_NAME = "assignEmployee"
        const val SCRIPT_DIRECTORY = "/opt/a12/scripts/workflow"
        val SCRIPT_URL: URL = URL("file:$SCRIPT_DIRECTORY/assign-employee.js")
    }

    private val delegateExecution: DelegateExecution = mockk(relaxed = true)

    @Nested
    @DisplayName("BusinessScriptBeforeExecuteEvent")
    inner class BeforeExecuteEvent {

        private val event = BusinessScriptBeforeExecuteEvent(SCRIPT_URL, DELEGATE_NAME, delegateExecution)

        @Test
        fun `should render the delegate name only`() {
            event.toString() shouldBe "BusinessScriptBeforeExecuteEvent(delegateName='$DELEGATE_NAME')"
        }

        @Test
        fun `should not render the script directory`() {
            event.toString() shouldNotInclude SCRIPT_DIRECTORY
        }
    }

    @Nested
    @DisplayName("BusinessScriptAfterExecuteEvent")
    inner class AfterExecuteEvent {

        @Test
        fun `should render the delegate name and no failure type on success`() {
            val event = BusinessScriptAfterExecuteEvent(SCRIPT_URL, DELEGATE_NAME, delegateExecution, null)

            event.toString() shouldBe "BusinessScriptAfterExecuteEvent(delegateName='$DELEGATE_NAME', failureType=null)"
        }

        @Test
        fun `should render the failure type without its message`() {
            val failureMessage = "Value 'Erika Mustermann' is not valid for /Employee/Name"
            val event = BusinessScriptAfterExecuteEvent(SCRIPT_URL, DELEGATE_NAME, delegateExecution, IllegalStateException(failureMessage))

            event.toString() shouldBe "BusinessScriptAfterExecuteEvent(delegateName='$DELEGATE_NAME', failureType=IllegalStateException)"
            event.toString() shouldNotInclude failureMessage
        }
    }
}
