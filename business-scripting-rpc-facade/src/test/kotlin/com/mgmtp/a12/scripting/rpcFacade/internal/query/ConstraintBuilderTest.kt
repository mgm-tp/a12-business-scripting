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

package com.mgmtp.a12.scripting.rpcFacade.internal.query

import com.mgmtp.a12.dataservices.query.constraint.logical.AndOperator
import com.mgmtp.a12.dataservices.query.constraint.logical.NotOperator
import com.mgmtp.a12.dataservices.query.constraint.logical.OrOperator
import com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator
import com.mgmtp.a12.dataservices.query.constraint.matching.SimpleSearchOperator
import com.mgmtp.a12.dataservices.query.constraint.range.DoubleRangeOperator
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

private class ConstraintBuilderTest {

    companion object {
        const val FIELD = "/Project/Name"
        const val VALUE = "test-value"
    }

    @Nested
    inner class ExactMatch {

        @Test
        fun `should build ExactMatchOperator with correct field and value`() {
            // given
            val constraint = mapOf("operator" to "exact_match", "field" to FIELD, "value" to VALUE)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<ExactMatchOperator<Any>>()
            operator.field shouldBe FIELD
            operator.value shouldBe VALUE
        }

        @Test
        fun `should build ExactMatchOperator with numeric value`() {
            // given
            val constraint = mapOf("operator" to "exact_match", "field" to FIELD, "value" to 42)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            result.shouldBeInstanceOf<ExactMatchOperator<Any>>().value shouldBe 42
        }
    }

    @Nested
    inner class NumericRange {

        @Test
        fun `should build DoubleRangeOperator with from and to`() {
            // given
            val constraint = mapOf("operator" to "numeric_range", "field" to FIELD, "from" to 10, "to" to 20)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<DoubleRangeOperator>()
            operator.field shouldBe FIELD
            operator.from shouldBe 10.0
            operator.to shouldBe 20.0
        }

        @Test
        fun `should build DoubleRangeOperator with only from`() {
            // given
            val constraint = mapOf("operator" to "numeric_range", "field" to FIELD, "from" to 5)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<DoubleRangeOperator>()
            operator.from shouldBe 5.0
            operator.to shouldBe null
        }

        @Test
        fun `should build DoubleRangeOperator with only to`() {
            // given
            val constraint = mapOf("operator" to "numeric_range", "field" to FIELD, "to" to 100)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<DoubleRangeOperator>()
            operator.from shouldBe null
            operator.to shouldBe 100.0
        }
    }

    @Nested
    inner class SimpleSearch {

        @Test
        fun `should build SimpleSearchOperator with value only`() {
            // given
            val constraint = mapOf("operator" to "simple_search", "value" to "search term")

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<SimpleSearchOperator>()
            operator.value shouldBe "search term"
            operator.fields shouldBe emptyArray<String>()
        }

        @Test
        fun `should build SimpleSearchOperator with value and field restriction`() {
            // given
            val constraint = mapOf(
                "operator" to "simple_search",
                "value" to "search term",
                "fields" to listOf(FIELD),
            )

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<SimpleSearchOperator>()
            operator.value shouldBe "search term"
            operator.fields shouldBe listOf(FIELD)
        }
    }

    @Nested
    inner class And {

        @Test
        fun `should build AndOperator with two exact-match operands`() {
            // given
            val operand1 = mapOf("operator" to "exact_match", "field" to FIELD, "value" to "foo")
            val operand2 = mapOf("operator" to "exact_match", "field" to "/Project/Status", "value" to "active")
            val constraint = mapOf("operator" to "and", "operands" to listOf(operand1, operand2))

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<AndOperator>()
            val operands = operator.operands.toList()
            operands shouldHaveSize 2
            operands[0].shouldBeInstanceOf<ExactMatchOperator<Any>>()
            operands[1].shouldBeInstanceOf<ExactMatchOperator<Any>>()
        }

        @Test
        fun `should build AndOperator with mixed operand types`() {
            // given
            val exactMatch = mapOf("operator" to "exact_match", "field" to FIELD, "value" to VALUE)
            val rangeMatch = mapOf("operator" to "numeric_range", "field" to "/Project/Year", "from" to 2020)
            val constraint = mapOf("operator" to "and", "operands" to listOf(exactMatch, rangeMatch))

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<AndOperator>()
            val operands = operator.operands.toList()
            operands shouldHaveSize 2
            operands[0].shouldBeInstanceOf<ExactMatchOperator<Any>>()
            operands[1].shouldBeInstanceOf<DoubleRangeOperator>()
        }
    }

    @Nested
    inner class Or {

        @Test
        fun `should build OrOperator with two operands`() {
            // given
            val operand1 = mapOf("operator" to "exact_match", "field" to FIELD, "value" to "foo")
            val operand2 = mapOf("operator" to "exact_match", "field" to FIELD, "value" to "bar")
            val constraint = mapOf("operator" to "or", "operands" to listOf(operand1, operand2))

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<OrOperator>()
            operator.operands shouldHaveSize 2
        }
    }

    @Nested
    inner class Not {

        @Test
        fun `should build NotOperator wrapping an ExactMatchOperator`() {
            // given
            val inner = mapOf("operator" to "exact_match", "field" to FIELD, "value" to VALUE)
            val constraint = mapOf("operator" to "not", "operand" to inner)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<NotOperator>()
            operator.operand.shouldBeInstanceOf<ExactMatchOperator<Any>>()
        }

        @Test
        fun `should build nested Not wrapping an AndOperator`() {
            // given
            val operand1 = mapOf("operator" to "exact_match", "field" to FIELD, "value" to "foo")
            val operand2 = mapOf("operator" to "exact_match", "field" to FIELD, "value" to "bar")
            val and = mapOf("operator" to "and", "operands" to listOf(operand1, operand2))
            val constraint = mapOf("operator" to "not", "operand" to and)

            // when
            val result = buildConstraintOperator(constraint)

            // then
            val operator = result.shouldBeInstanceOf<NotOperator>()
            operator.operand.shouldBeInstanceOf<AndOperator>()
        }
    }

    @Nested
    inner class UnknownOperator {

        @Test
        fun `should throw IllegalArgumentException for unknown operator`() {
            // given
            val constraint = mapOf("operator" to "unknown_op")

            // when / then
            shouldThrow<IllegalArgumentException> {
                buildConstraintOperator(constraint)
            }
        }
    }
}
