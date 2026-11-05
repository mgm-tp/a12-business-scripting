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

package com.mgmtp.a12.scripting.shared.internal.functions

import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

private class ScriptMetadataParserTest {

    @Nested
    @DisplayName("Parse param types from script")
    inner class ParseParamTypes {

        @Test
        fun `should extract param types from script text`() {
            // given
            val script = """
                function myFunc(docRef, name) {}
                myFunc.__paramTypes = {"docRef":"DocumentReference","name":"string"};
            """.trimIndent()

            // when
            val result = ScriptMetadataParser.parseParamTypesFromScript(script)

            // then
            result shouldBe linkedMapOf("docRef" to "DocumentReference", "name" to "string")
        }

        @Test
        fun `should extract single param type`() {
            // given
            val script = """
                function myFunc(name) {}
                myFunc.__paramTypes = {"name":"string"};
            """.trimIndent()

            // when
            val result = ScriptMetadataParser.parseParamTypesFromScript(script)

            // then
            result shouldBe linkedMapOf("name" to "string")
        }

        @Test
        fun `should return empty map for empty metadata block`() {
            // given
            val script = """
                function myFunc() {}
                myFunc.__paramTypes = {};
            """.trimIndent()

            // when / then
            ScriptMetadataParser
                .parseParamTypesFromScript(script)
                .shouldBeEmpty()
        }

        @Test
        fun `should return empty map for script without param types`() {
            // when / then
            ScriptMetadataParser
                .parseParamTypesFromScript("function myFunc() {}")
                .shouldBeEmpty()
        }
    }

    @Nested
    @DisplayName("Parse return properties from script")
    inner class ParseReturnProperties {

        @Test
        fun `should extract return properties from script text`() {
            // given
            val script = """
                function myFunc() {}
                myFunc.__returnProperties = {"resultDocRef":"DocumentReference","name":"string"};
            """.trimIndent()

            // when
            val result = ScriptMetadataParser.parseReturnPropertiesFromScript(script)

            // then
            result shouldBe linkedMapOf("resultDocRef" to "DocumentReference", "name" to "string")
        }

        @Test
        fun `should extract return properties when metadata value contains closing brace`() {
            // given - simulates metadata generated from an Outputs interface with inline comment containing }
            val script = """
                function myFunc() {}
                myFunc.__returnProperties = {"result":"SomeType; // see {detail} for more","name":"string"};
            """.trimIndent()

            // when
            val result = ScriptMetadataParser.parseReturnPropertiesFromScript(script)

            // then - parser returns the raw JSON value including comment text; stripping comments is devtools' responsibility
            result shouldBe linkedMapOf("result" to "SomeType; // see {detail} for more", "name" to "string")
        }

        @Test
        fun `should return empty map for script without return properties`() {
            // when / then
            ScriptMetadataParser
                .parseReturnPropertiesFromScript("function myFunc() {}")
                .shouldBeEmpty()
        }
    }
}
