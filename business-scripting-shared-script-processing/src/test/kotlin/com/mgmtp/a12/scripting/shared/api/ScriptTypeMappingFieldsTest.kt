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

package com.mgmtp.a12.scripting.shared.api

import io.kotest.matchers.shouldBe
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Value
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
private class ScriptTypeMappingFieldsTest {

    companion object {
        private const val FIELD = "field"
        private const val LABEL = "label"
    }

    private val context: Context = Context.create("js")

    private fun scriptValue(expression: String): Value = context.eval("js", expression)

    @AfterAll
    fun tearDown() = context.close()

    @Nested
    inner class ScriptValueFields {

        @Test
        fun `should read a field of the requested type`() {
            scriptValue("({field: 'text'})").stringFieldOrNull(FIELD) shouldBe "text"
            scriptValue("({field: 7})").intFieldOrNull(FIELD) shouldBe 7
            scriptValue("({field: 7.0})").intFieldOrNull(FIELD) shouldBe 7
            scriptValue("({field: 7})").longFieldOrNull(FIELD) shouldBe 7L
            scriptValue("({field: 7.5})").doubleFieldOrNull(FIELD) shouldBe 7.5
            scriptValue("({field: 7})").doubleFieldOrNull(FIELD) shouldBe 7.0
            scriptValue("({field: true})").booleanFieldOrNull(FIELD) shouldBe true
        }

        @Test
        fun `should return null for a field of another type`() {
            scriptValue("({field: 7})").stringFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: '7'})").intFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: 7.5})").intFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: '7'})").longFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: 7.5})").longFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: '7.5'})").doubleFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: 'true'})").booleanFieldOrNull(FIELD) shouldBe null
        }

        @Test
        fun `should return null for a missing, null or undefined field`() {
            scriptValue("({})").stringFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: null})").stringFieldOrNull(FIELD) shouldBe null
            scriptValue("({field: undefined})").stringFieldOrNull(FIELD) shouldBe null
        }

        @Test
        fun `should read a list field by parsing every element`() {
            scriptValue("({field: [{label: 'first'}, {label: 'second'}]})")
                .listFieldOrNull(FIELD, ::labelOfScriptValue) shouldBe listOf("first", "second")
            scriptValue("({field: []})").listFieldOrNull(FIELD, ::labelOfScriptValue) shouldBe emptyList()
        }

        @Test
        fun `should return null for a list field with an element that does not parse`() {
            scriptValue("({field: [{label: 'first'}, {label: 7}]})").listFieldOrNull(FIELD, ::labelOfScriptValue) shouldBe null
        }

        @Test
        fun `should return null for a list field that is no array, is missing or is null`() {
            scriptValue("({field: 'text'})").listFieldOrNull(FIELD, ::labelOfScriptValue) shouldBe null
            scriptValue("({})").listFieldOrNull(FIELD, ::labelOfScriptValue) shouldBe null
            scriptValue("({field: null})").listFieldOrNull(FIELD, ::labelOfScriptValue) shouldBe null
        }

        @Test
        fun `should return null for values that have no fields at all`() {
            scriptValue("42").stringFieldOrNull(FIELD) shouldBe null
            scriptValue("'text'").stringFieldOrNull(FIELD) shouldBe null
            scriptValue("null").stringFieldOrNull(FIELD) shouldBe null
            scriptValue("undefined").stringFieldOrNull(FIELD) shouldBe null
        }
    }

    @Nested
    inner class ScriptValueHostObjects {

        @Test
        fun `should unwrap a host object of the requested type`() {
            context.asValue(HostLabel("first")).hostObjectOrNull(HostLabel::class.java) shouldBe HostLabel("first")
        }

        @Test
        fun `should not read a field of a host object, which exposes its getters only`() {
            context.asValue(HostLabel("first")).stringFieldOrNull(LABEL) shouldBe null
        }

        @Test
        fun `should return null for a host object of another type and for a script object`() {
            context.asValue(OtherHostValue(7)).hostObjectOrNull(HostLabel::class.java) shouldBe null
            scriptValue("({label: 'first'})").hostObjectOrNull(HostLabel::class.java) shouldBe null
        }
    }

    @Nested
    inner class ExecutionContextValueFields {

        @Test
        fun `should read a field of the requested type`() {
            mapOf(FIELD to "text").stringFieldOrNull(FIELD) shouldBe "text"
            mapOf(FIELD to 7).intFieldOrNull(FIELD) shouldBe 7
            mapOf(FIELD to 7L).longFieldOrNull(FIELD) shouldBe 7L
            mapOf(FIELD to 7.5).doubleFieldOrNull(FIELD) shouldBe 7.5
            mapOf(FIELD to true).booleanFieldOrNull(FIELD) shouldBe true
        }

        @Test
        fun `should read whole numbers delivered as Long or Double`() {
            mapOf(FIELD to 7L).intFieldOrNull(FIELD) shouldBe 7
            mapOf(FIELD to 7.0).intFieldOrNull(FIELD) shouldBe 7
            mapOf(FIELD to 7).longFieldOrNull(FIELD) shouldBe 7L
            mapOf(FIELD to 7.0).longFieldOrNull(FIELD) shouldBe 7L
            mapOf(FIELD to 7).doubleFieldOrNull(FIELD) shouldBe 7.0
        }

        @Test
        fun `should read a list field by parsing every element`() {
            mapOf(FIELD to listOf(mapOf(LABEL to "first"), mapOf(LABEL to "second")))
                .listFieldOrNull(FIELD, ::labelOfExecutionContextValue) shouldBe listOf("first", "second")
        }

        @Test
        fun `should return null for a list field with an element that does not parse and for a field that is no list`() {
            mapOf(FIELD to listOf(mapOf(LABEL to "first"), mapOf(LABEL to 7)))
                .listFieldOrNull(FIELD, ::labelOfExecutionContextValue) shouldBe null
            mapOf(FIELD to "text").listFieldOrNull(FIELD, ::labelOfExecutionContextValue) shouldBe null
            emptyMap<String, Any>().listFieldOrNull(FIELD, ::labelOfExecutionContextValue) shouldBe null
        }

        @Test
        fun `should return null for a fractional number, another type or a missing field`() {
            mapOf(FIELD to 7.5).intFieldOrNull(FIELD) shouldBe null
            mapOf(FIELD to 7.5).longFieldOrNull(FIELD) shouldBe null
            mapOf(FIELD to "7").intFieldOrNull(FIELD) shouldBe null
            mapOf(FIELD to "7").longFieldOrNull(FIELD) shouldBe null
            mapOf(FIELD to "7.5").doubleFieldOrNull(FIELD) shouldBe null
            mapOf(FIELD to null).stringFieldOrNull(FIELD) shouldBe null
            emptyMap<String, Any>().stringFieldOrNull(FIELD) shouldBe null
        }
    }
}

private fun labelOfScriptValue(element: Value): String? = element.stringFieldOrNull("label")

private fun labelOfExecutionContextValue(element: Any): String? = (element as? Map<*, *>)?.stringFieldOrNull("label")
