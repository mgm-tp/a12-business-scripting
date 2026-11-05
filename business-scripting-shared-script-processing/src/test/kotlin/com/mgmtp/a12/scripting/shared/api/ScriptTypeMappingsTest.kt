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

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Value
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
private class ScriptTypeMappingsTest {

    companion object {
        private const val ITEMS = "items"
        private const val ITEM = "item"
        private const val ITEM_NAME = "itemName"
    }

    private val context: Context = Context.create("js")

    private val nestedItemMapping = ScriptTypeMapping(
        typeName = "NestedItem",
        targetType = NestedItem::class.java,
        parseInput = { raw -> (raw as? Map<*, *>)?.stringFieldOrNull(ITEM_NAME)?.let(::NestedItem) },
        parseOutput = { value -> value.stringFieldOrNull(ITEM_NAME)?.let(::NestedItem) },
    )

    private val mappings = ScriptTypeMappings { listOf(nestedItemMapping) }

    private fun scriptValue(expression: String): Value = context.eval("js", expression)

    @AfterAll
    fun tearDown() = context.close()

    @Test
    fun `should parse a list field of a script value with the mapping registered for the element type`() {
        val value = scriptValue("({items: [{itemName: 'first'}, {itemName: 'second'}]})")

        mappings.listFieldOrNull(value, ITEMS, NestedItem::class.java) shouldBe listOf(NestedItem("first"), NestedItem("second"))
    }

    @Test
    fun `should parse a list field of an execution context value with the mapping registered for the element type`() {
        val raw = mapOf(ITEMS to listOf(mapOf(ITEM_NAME to "first"), mapOf(ITEM_NAME to "second")))

        mappings.listFieldOrNull(raw, ITEMS, NestedItem::class.java) shouldBe listOf(NestedItem("first"), NestedItem("second"))
    }

    @Test
    fun `should parse a list element the script received as an input and passed on`() {
        // given a list holding a value the script did not build itself
        val value = context.eval("js", "(item) => ({items: [item]})").execute(NestedItem("first"))

        // then
        mappings.listFieldOrNull(value, ITEMS, NestedItem::class.java) shouldBe listOf(NestedItem("first"))
    }

    @Test
    fun `should parse a single nested field`() {
        mappings.fieldOrNull(scriptValue("({item: {itemName: 'first'}})"), ITEM, NestedItem::class.java) shouldBe NestedItem("first")
        mappings.fieldOrNull(mapOf(ITEM to mapOf(ITEM_NAME to "first")), ITEM, NestedItem::class.java) shouldBe NestedItem("first")
    }

    @Test
    fun `should return null when an element does not parse, the field is no list or the field is missing`() {
        mappings.listFieldOrNull(scriptValue("({items: [{itemName: 7}]})"), ITEMS, NestedItem::class.java) shouldBe null
        mappings.listFieldOrNull(scriptValue("({items: 'text'})"), ITEMS, NestedItem::class.java) shouldBe null
        mappings.listFieldOrNull(scriptValue("({})"), ITEMS, NestedItem::class.java) shouldBe null
        mappings.fieldOrNull(scriptValue("({})"), ITEM, NestedItem::class.java) shouldBe null
    }

    @Test
    fun `should see a mapping registered after a lookup that ran while the application was still starting`() {
        // given a registry asked before every mapping bean exists
        val registeredMappings = mutableListOf<ScriptTypeMapping<*>>()
        val startingUp = ScriptTypeMappings { registeredMappings.toList() }
        val raw = mapOf(ITEMS to listOf(mapOf(ITEM_NAME to "first")))
        shouldThrow<IllegalStateException> { startingUp.listFieldOrNull(raw, ITEMS, NestedItem::class.java) }

        // when the missing mapping is registered and the registry is indexed
        registeredMappings += nestedItemMapping
        startingUp.indexRegisteredMappings()

        // then
        startingUp.listFieldOrNull(raw, ITEMS, NestedItem::class.java) shouldBe listOf(NestedItem("first"))
    }

    @Test
    fun `should report a missing mapping by the field name and never by the JVM type behind it`() {
        val value = scriptValue("({items: [{itemName: 'first'}]})")

        val exception = shouldThrow<IllegalStateException> { mappings.listFieldOrNull(value, ITEMS, Wrapped::class.java) }

        exception.message.shouldContain(ITEMS)
        exception.message.shouldNotContain(Wrapped::class.java.simpleName)
    }
}
