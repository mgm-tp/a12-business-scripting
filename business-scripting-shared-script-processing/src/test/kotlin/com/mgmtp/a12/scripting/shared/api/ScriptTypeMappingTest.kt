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
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

private class ScriptTypeMappingTest {

    companion object {
        private const val TYPE_NAME = "Wrapped"
        private const val REJECTED_VALUE = "s3cr3t"
    }

    private val bothDirections = ScriptTypeMapping(
        typeName = TYPE_NAME,
        targetType = Wrapped::class.java,
        parseInput = { raw -> (raw as? String)?.takeIf { it != REJECTED_VALUE }?.let(::Wrapped) },
        parseOutput = { value ->
            value
                .takeIf(Value::isString)
                ?.asString()
                ?.takeIf { it != REJECTED_VALUE }
                ?.let(::Wrapped)
        },
    )

    private val noDirections = ScriptTypeMapping(typeName = TYPE_NAME, targetType = Wrapped::class.java)

    @Nested
    inner class SupportedDirections {

        @Test
        fun `should support input only when an input parser is given`() {
            bothDirections.supportsInput shouldBe true
            noDirections.supportsInput shouldBe false
        }

        @Test
        fun `should support output only when an output parser is given`() {
            bothDirections.supportsOutput shouldBe true
            noDirections.supportsOutput shouldBe false
        }
    }

    @Nested
    inner class Acceptance {

        @Test
        fun `should accept input the parser converts and reject input it does not`() {
            bothDirections.acceptsInput("hello") shouldBe true
            bothDirections.acceptsInput(REJECTED_VALUE) shouldBe false
            bothDirections.acceptsInput(42) shouldBe false
        }

        @Test
        fun `should accept output the parser converts and reject output it does not`() {
            bothDirections.acceptsOutput(Value.asValue("hello")) shouldBe true
            bothDirections.acceptsOutput(Value.asValue(REJECTED_VALUE)) shouldBe false
            bothDirections.acceptsOutput(Value.asValue(42)) shouldBe false
        }

        @Test
        fun `should accept nothing in a direction without a parser`() {
            noDirections.acceptsInput("hello") shouldBe false
            noDirections.acceptsOutput(Value.asValue("hello")) shouldBe false
        }
    }

    @Nested
    inner class NestedParsing {

        @Test
        fun `should return the parsed value or null instead of throwing`() {
            bothDirections.parseInputOrNull("hello") shouldBe Wrapped("hello")
            bothDirections.parseInputOrNull(REJECTED_VALUE) shouldBe null
            bothDirections.parseOutputOrNull(Value.asValue("hello")) shouldBe Wrapped("hello")
            bothDirections.parseOutputOrNull(Value.asValue(REJECTED_VALUE)) shouldBe null
        }

        @Test
        fun `should return null in a direction without a parser`() {
            noDirections.parseInputOrNull("hello") shouldBe null
            noDirections.parseOutputOrNull(Value.asValue("hello")) shouldBe null
        }

        @Test
        fun `should take an output the script received as an input and passed on`() {
            Context.create().use { context ->
                // given a value the script did not build itself, which GraalVM unwraps only at the top level
                val passedOnValue = context.asValue(Wrapped("hello"))

                // then
                bothDirections.parseOutputOrNull(passedOnValue) shouldBe Wrapped("hello")
            }
        }
    }

    @Nested
    inner class Conversion {

        @Test
        fun `should convert accepted input and output`() {
            bothDirections.convertInput("hello") shouldBe Wrapped("hello")
            bothDirections.convertOutput(Value.asValue("hello")) shouldBe Wrapped("hello")
        }

        @Test
        fun `should throw naming the script type but never the value when input is rejected`() {
            val exception = shouldThrow<IllegalArgumentException> { bothDirections.convertInput(REJECTED_VALUE) }

            exception.message.shouldContain(TYPE_NAME)
            exception.message.shouldNotContain(REJECTED_VALUE)
        }

        @Test
        fun `should throw naming the script type but never the value when output is rejected`() {
            val exception = shouldThrow<IllegalArgumentException> { bothDirections.convertOutput(Value.asValue(REJECTED_VALUE)) }

            exception.message.shouldContain(TYPE_NAME)
            exception.message.shouldNotContain(REJECTED_VALUE)
        }

        @Test
        fun `should throw when converting in a direction the mapping does not support`() {
            shouldThrow<UnsupportedOperationException> { noDirections.convertInput("hello") }
            shouldThrow<UnsupportedOperationException> { noDirections.convertOutput(Value.asValue("hello")) }
        }
    }
}
