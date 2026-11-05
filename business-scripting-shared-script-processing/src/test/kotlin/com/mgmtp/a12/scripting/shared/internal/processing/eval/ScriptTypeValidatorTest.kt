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

package com.mgmtp.a12.scripting.shared.internal.processing.eval

import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

private class ScriptTypeValidatorTest {

    private val mappings: List<ScriptTypeMapping<*>> = listOf(documentReferenceScriptTypeMapping)
    private val typeMappings = mappings.associateBy { it.typeName }
    private val validator: ScriptTypeValidator = ScriptTypeValidator(mappings)

    data class PassingCase(
        val description: String,
        val typings: Map<String, String>,
    ) {
        override fun toString() = description
    }

    data class ErrorCase(
        val description: String,
        val typings: Map<String, String>,
        val errorMessage: String,
    ) {
        override fun toString() = description
    }

    companion object {
        @JvmStatic
        fun errorCases() = listOf(
            ErrorCase(
                "union",
                mapOf("unionValue" to "string | number"),
                "Union type 'unionValue: string | number' is not allowed!",
            ),
            ErrorCase(
                "optional",
                mapOf("optionalValue?" to "string"),
                "Optional type 'optionalValue?: string' is not allowed!",
            ),
            ErrorCase(
                "undefined",
                mapOf("undefinedValue" to "undefined"),
                "Undefined type 'undefinedValue: undefined' is not allowed!",
            ),
            ErrorCase(
                "unknown custom type",
                mapOf("unknownCustomTypeValue" to "UnknownCustomType"),
                "Unknown custom type 'unknownCustomTypeValue: UnknownCustomType' is not allowed!",
            ),
            ErrorCase(
                "nested type",
                mapOf("nestedTypeValue" to "{ inner: string }"),
                "Nested type 'nestedTypeValue: { inner: string }' is not allowed!",
            ),
            ErrorCase(
                "line comment not stripped",
                mapOf("typeWithLineComment" to "DocumentReference // a document reference"),
                "Line comment in 'typeWithLineComment: DocumentReference // a document reference' is not allowed!",
            ),
            ErrorCase(
                "block comment not stripped",
                mapOf("typeWithBlockComment" to "DocumentReference /* a document reference */"),
                "Block comment in 'typeWithBlockComment: DocumentReference /* a document reference */' is not allowed!",
            ),
            ErrorCase(
                "multiline type not flattened",
                mapOf("multilineType" to "{\n  inner: string\n}"),
                "Multiline type 'multilineType: {\n  inner: string\n}' is not allowed!",
            ),
        )

        @JvmStatic
        fun successCases() = listOf(
            PassingCase(
                "known custom type",
                mapOf("knownCustomType" to "DocumentReference"),
            ),
            PassingCase(
                "number type",
                mapOf("numberValue" to "number"),
            ),
            PassingCase(
                "string type",
                mapOf("stringValue" to "string"),
            ),
            PassingCase(
                "boolean type",
                mapOf("booleanValue" to "boolean"),
            ),
            PassingCase(
                "array type",
                mapOf("arrayValue" to "string[]"),
            ),
            PassingCase(
                "Array<*> type",
                mapOf("arrayValue" to "Array<number>"),
            ),
            PassingCase(
                "SimpleList type",
                mapOf("simpleListValue" to "SimpleList<DocumentReference>"),
            ),
            PassingCase(
                "nested array type",
                mapOf("nestedArraysValue" to "number[][]"),
            ),
            PassingCase(
                "nested array in list type",
                mapOf("nestedArraysValue" to "SimpleList<DocumentReference[]>"),
            ),
        )
    }

    @Nested
    @DisplayName("Validate script typings")
    inner class ValidateScriptInputTypings {

        @ParameterizedTest(name = "should throw for unsupported type {0}")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptTypeValidatorTest#errorCases")
        fun `should throw for unsupported types`(case: ErrorCase) {
            val exception = shouldThrow<IllegalArgumentException> {
                validator.validateScriptTypings(case.typings, typeMappings, "Descriptor")
            }

            exception.message shouldContain case.errorMessage
        }

        @ParameterizedTest(name = "should pass for supported type {0}")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptTypeValidatorTest#successCases")
        fun `should pass for supported types`(passingCase: PassingCase) {
            shouldNotThrowAny {
                validator.validateScriptTypings(passingCase.typings, typeMappings, "Descriptor")
            }
        }
    }

    @Nested
    inner class Description {
        @Test
        fun `should use provided description in error messages`() {
            val exception = shouldThrow<IllegalArgumentException> {
                validator.validateScriptTypings(mapOf("unionValue" to "string | number"), typeMappings, "Descriptor")
            }
            exception.message shouldContain "Descriptor"
        }

        @Test
        fun `should use 'Script Inputs' for validateScriptInputTypes()`() {
            val exception = shouldThrow<IllegalArgumentException> {
                validator.validateScriptInputTypings(mapOf("unionValue" to "string | number"))
            }
            exception.message shouldContain "Script Inputs"
        }

        @Test
        fun `should use 'Script Outputs' for validateScriptOutputTypes()`() {
            val exception = shouldThrow<IllegalArgumentException> {
                validator.validateScriptOutputTypings(mapOf("unionValue" to "string | number"))
            }
            exception.message shouldContain "Script Outputs"
        }
    }
}
