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

package com.mgmtp.a12.scripting.dataservices.callable.api.events.execution

import io.kotest.matchers.string.shouldInclude
import io.kotest.matchers.string.shouldNotInclude
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import java.net.URI

/**
 * A listener that logs an event it received is the expected way to leak the caller's arguments,
 * so the events render themselves without their values.
 */
private class ScriptExecutionEventRenderingTest {

    companion object {
        const val SCRIPT_NAME = "assign-employee"
        const val ARGUMENT_KEY = "employeeName"
        const val ARGUMENT_VALUE = "Erika Mustermann"
        const val SCRIPT_DIRECTORY = "/opt/a12/scripts/callable"
        val SCRIPT_URI: URI = URI.create("file:$SCRIPT_DIRECTORY/assign-employee.js")
        val ARGUMENTS = mapOf(ARGUMENT_KEY to ARGUMENT_VALUE)
    }

    @Nested
    @DisplayName("BusinessScriptBeforeExecuteEvent")
    inner class BeforeExecuteEvent {

        private val event = BusinessScriptBeforeExecuteEvent(SCRIPT_URI, SCRIPT_NAME, ARGUMENTS)

        @Test
        fun `should not render argument values or the script directory`() {
            event.toString() shouldNotInclude ARGUMENT_VALUE
            event.toString() shouldNotInclude SCRIPT_DIRECTORY
        }

        @Test
        fun `should render the script name and the argument keys`() {
            event.toString() shouldInclude SCRIPT_NAME
            event.toString() shouldInclude ARGUMENT_KEY
        }
    }

    @Nested
    @DisplayName("BusinessScriptAfterExecuteEvent")
    inner class AfterExecuteEvent {

        @Test
        fun `should not render argument values`() {
            val event = BusinessScriptAfterExecuteEvent(SCRIPT_URI, SCRIPT_NAME, ARGUMENTS, null)

            event.toString() shouldNotInclude ARGUMENT_VALUE
        }

        @Test
        fun `should render the failure type without its message`() {
            val failureMessage = "Value '$ARGUMENT_VALUE' is not valid for /Employee/Name"
            val event = BusinessScriptAfterExecuteEvent(SCRIPT_URI, SCRIPT_NAME, ARGUMENTS, IllegalStateException(failureMessage))

            event.toString() shouldInclude IllegalStateException::class.java.simpleName
            event.toString() shouldNotInclude failureMessage
        }
    }
}
