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

package com.mgmtp.a12.scripting.rpcFacade.internal.retry

import io.kotest.matchers.shouldBe
import jakarta.validation.Validation
import jakarta.validation.Validator
import org.junit.jupiter.api.Test

private class RpcRetryPropertiesTest {

    private val validator: Validator = Validation.buildDefaultValidatorFactory().validator

    @Test
    fun `should have correct default values`() {
        // when
        val properties = RpcRetryProperties()

        // then
        properties.maxAttempts shouldBe 3
        properties.initialDelayMs shouldBe 1500L
        properties.multiplier shouldBe 2.0
    }

    @Test
    fun `should reject maxAttempts less than 1`() {
        // given
        val properties = RpcRetryProperties(maxAttempts = 0)

        // when
        val violations = validator.validate(properties)

        // then
        violations.map { it.propertyPath.toString() } shouldBe listOf("maxAttempts")
    }

    @Test
    fun `should reject initialDelayMs less than 0`() {
        // given
        val properties = RpcRetryProperties(initialDelayMs = -1)

        // when
        val violations = validator.validate(properties)

        // then
        violations.map { it.propertyPath.toString() } shouldBe listOf("initialDelayMs")
    }

    @Test
    fun `should reject multiplier less than 1`() {
        // given
        val properties = RpcRetryProperties(multiplier = 0.99)

        // when
        val violations = validator.validate(properties)

        // then
        violations.map { it.propertyPath.toString() } shouldBe listOf("multiplier")
    }
}
