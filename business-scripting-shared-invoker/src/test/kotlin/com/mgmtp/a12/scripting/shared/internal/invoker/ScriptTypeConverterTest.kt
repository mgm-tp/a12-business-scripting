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

package com.mgmtp.a12.scripting.shared.internal.invoker

import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.context.ScriptLocationIoAccessProvider
import com.mgmtp.a12.scripting.shared.internal.processing.eval.documentReferenceScriptTypeMapping
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.Value
import org.junit.jupiter.api.*
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource
import kotlin.reflect.KClass

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
private class ScriptTypeConverterTest {

    private val engine: Engine = Engine.create("js")
    private val converter: ScriptTypeConverter = ScriptTypeConverter(listOf(documentReferenceScriptTypeMapping))
    private val ctx: Context = JsContextFactory(engine, listOf(documentReferenceScriptTypeMapping), ScriptLocationIoAccessProvider(emptyList())).createContext()

    @AfterAll
    fun tearDown() {
        ctx.close()
        engine.close()
    }

    data class JsToJavaCase(
        val description: String,
        val scriptValueExpression: String,
        val returnType: String,
        val expectedClass: KClass<*>,
        val expectedValue: Any,
    ) {
        override fun toString() = description
    }

    /**
     * @param expectedTypeName The Kotlin type name the message must name instead of the value, or
     *   `null` where the type name is not stable enough to assert.
     * @param forbiddenValueText Part of the rendered input value that must never reach the message.
     */
    data class JavaToJsTypeMismatchCase(
        val description: String,
        val input: Any,
        val paramType: String,
        val expectedTypeName: String?,
        val forbiddenValueText: String,
    ) {
        override fun toString() = description
    }

    data class JsToJavaTypeMismatchCase(
        val description: String,
        val scriptValueExpression: String,
        val returnType: String,
    ) {
        override fun toString() = description
    }

    /**
     * @param forbiddenValueText Part of the rendered script result that must never reach the message.
     */
    data class JsToJavaPrimitiveMismatchCase(
        val description: String,
        val scriptValueExpression: String,
        val returnType: String,
        val forbiddenValueText: String,
    ) {
        override fun toString() = description
    }

    data class JavaToJsArrayCase(
        val description: String,
        val inputList: List<Any>,
        val paramType: String,
        val expectedSize: Int,
    ) {
        override fun toString() = description
    }

    companion object {
        /** Stands for personal data a script result may hold. */
        private const val PERSONAL_DATA_MARKER = "Jane Doe"

        @JvmStatic
        fun jsToJavaCases() = listOf(
            JsToJavaCase("string as String", "'hello'", "string", String::class, "hello"),
            JsToJavaCase("boolean as Boolean", "true", "boolean", Boolean::class, true),
            JsToJavaCase("integer number as Integer", "42", "number", Int::class, 42),
            JsToJavaCase("large integer number as Long", "3000000000", "number", Long::class, 3_000_000_000L),
            JsToJavaCase("fractional number as Double", "3.14", "number", Double::class, 3.14),
            JsToJavaCase(
                "DocumentReference output as DocumentReference",
                "new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/1')",
                "DocumentReference",
                DocumentReference::class,
                DocumentReference("Project_DM/1"),
            ),
            JsToJavaCase(
                "plain JS object with documentModelName and documentId as DocumentReference",
                "({ documentModelName: 'Project_DM', documentId: '1' })",
                "DocumentReference",
                DocumentReference::class,
                DocumentReference("Project_DM/1"),
            ),
            JsToJavaCase(
                "string array as List<String>",
                "['hello', 'world']",
                "string[]",
                ArrayList::class,
                listOf("hello", "world"),
            ),
            JsToJavaCase(
                "DocumentReference array as List<DocumentReference>",
                "[new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/1'), new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/2')]",
                "DocumentReference[]",
                ArrayList::class,
                listOf(DocumentReference("Project_DM/1"), DocumentReference("Project_DM/2")),
            ),
            JsToJavaCase(
                "Array<DocumentReference> as List<DocumentReference>",
                "[new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/1'), new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/2')]",
                "Array<DocumentReference>",
                ArrayList::class,
                listOf(DocumentReference("Project_DM/1"), DocumentReference("Project_DM/2")),
            ),
            JsToJavaCase(
                "SimpleList<DocumentReference> as List<DocumentReference>",
                "({ items: [new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/1'), new (Java.type('com.mgmtp.a12.dataservices.document.DocumentReference'))('Project_DM/2')] })",
                "SimpleList<DocumentReference>",
                ArrayList::class,
                listOf(DocumentReference("Project_DM/1"), DocumentReference("Project_DM/2")),
            ),
        )

        @JvmStatic
        fun javaToJsArrayCases() = listOf(
            JavaToJsArrayCase("string[]", listOf("hello", "world"), "string[]", 2),
            JavaToJsArrayCase("number[]", listOf(1, 2, 3), "number[]", 3),
            JavaToJsArrayCase("boolean[]", listOf(true, false), "boolean[]", 2),
            JavaToJsArrayCase(
                "DocumentReference[]",
                listOf("Project_DM/1", "Project_DM/2"),
                "DocumentReference[]",
                2,
            ),
            JavaToJsArrayCase(
                "Array<DocumentReference>",
                listOf("Project_DM/1", "Project_DM/2"),
                "Array<DocumentReference>",
                2,
            ),
        )

        @JvmStatic
        fun javaToJsTypeMismatchCases() = listOf(
            JavaToJsTypeMismatchCase("non-iterable for string[] param type", 42, "string[]", "Int", "42"),
            JavaToJsTypeMismatchCase("non-string for string param type", mapOf("docRef" to "abc/123"), "string", null, "abc/123"),
            JavaToJsTypeMismatchCase("non-number for number param type", "not-a-number", "number", "String", "not-a-number"),
            JavaToJsTypeMismatchCase("non-boolean for boolean param type", "yes please", "boolean", "String", "yes please"),
            JavaToJsTypeMismatchCase("incompatible value for DocumentReference param type", 42, "DocumentReference", "Int", "42"),
        )

        @JvmStatic
        fun jsToJavaInvalidCustomTypeCases() = listOf(
            // Should fail because a null member must never become the text "null" inside the reference
            JsToJavaTypeMismatchCase("member is null", "({ documentModelName: 'Project_DM', documentId: null })", "DocumentReference"),
            JsToJavaTypeMismatchCase("member is missing", "({ documentModelName: 'Project_DM' })", "DocumentReference"),
            JsToJavaTypeMismatchCase("value has no members", "42", "DocumentReference"),
            // Should fail because a document id must be a string, as it is in every reference the platform issues
            JsToJavaTypeMismatchCase("documentId is a number", "({ documentModelName: 'Project_DM', documentId: 1 })", "DocumentReference"),
            // Should fail because DocumentReference accepts exactly one model name and one id
            JsToJavaTypeMismatchCase("string is not a well formed reference", "'not-a-reference'", "DocumentReference"),
        )

        @JvmStatic
        fun jsToJavaPrimitiveMismatchCases() = listOf(
            JsToJavaPrimitiveMismatchCase("string returnType receives non-string", "4711", "string", "4711"),
            JsToJavaPrimitiveMismatchCase("number returnType receives non-number", "'$PERSONAL_DATA_MARKER'", "number", PERSONAL_DATA_MARKER),
            JsToJavaPrimitiveMismatchCase("boolean returnType receives non-boolean", "'$PERSONAL_DATA_MARKER'", "boolean", PERSONAL_DATA_MARKER),
        )
    }

    @Nested
    @DisplayName("convertJsToJava")
    inner class ConvertOutput {

        @ParameterizedTest(name = "should convert {0}")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverterTest#jsToJavaCases")
        fun `should extract output value with correct type`(case: JsToJavaCase) {
            // given
            val value = ctx.eval("js", case.scriptValueExpression)

            // when
            val result = converter.convertJsToJava(value, case.returnType)

            // then
            result!!::class shouldBe case.expectedClass
            result shouldBe case.expectedValue
        }

        @ParameterizedTest(name = "should throw naming the type but not the value when {0}")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverterTest#jsToJavaPrimitiveMismatchCases")
        fun `should throw naming the return type but never the script result when it does not match`(case: JsToJavaPrimitiveMismatchCase) {
            // given
            val value = ctx.eval("js", case.scriptValueExpression)

            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJsToJava(value, case.returnType)
            }

            // then
            exception.message.shouldContain(case.returnType)
            exception.message.shouldNotContain(case.forbiddenValueText)
        }

        @ParameterizedTest(name = "should reject DocumentReference output when {0}")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverterTest#jsToJavaInvalidCustomTypeCases")
        fun `should throw naming the type but never the script result when custom type output is invalid`(case: JsToJavaTypeMismatchCase) {
            // given
            val value = ctx.eval("js", case.scriptValueExpression)

            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJsToJava(value, case.returnType)
            }

            // then — neither the script result nor the JVM class behind the type may reach the caller
            exception.message.shouldContain(case.returnType)
            exception.message.shouldNotContain("com.mgmtp.a12.dataservices")
            exception.message.shouldNotContain("Project_DM")
        }

        @Test
        fun `should convert a well formed string to DocumentReference`() {
            // when
            val result = converter.convertJsToJava(ctx.eval("js", "'Project_DM/1'"), "DocumentReference")

            // then
            result shouldBe DocumentReference("Project_DM/1")
        }

        @Test
        fun `should throw naming the JS type but not the value when non-array value returned for array return type`() {
            // given
            val value = ctx.eval("js", "4711")

            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJsToJava(value, "string[]")
            }

            // then — the script result must not reach the caller, and the type must be the JS-visible one
            exception.message.shouldContain("number")
            exception.message.shouldNotContain("4711")
        }
    }

    @Nested
    @DisplayName("convertJavaToJs")
    inner class ConvertInput {

        @Test
        fun `should pass null input to script when argument value is null`() {
            // when
            val result = converter.convertJavaToJs(null, "DocumentReference", ctx)

            // then
            result shouldBe null
        }

        @Test
        fun `should pass through value for param type not covered by conversion`() {
            // when
            val result = converter.convertJavaToJs("hello", "SomeUnmappedType", ctx)

            // then
            result shouldBe "hello"
        }

        @Test
        fun `should convert well formed string argument to DocumentReference when param type is DocumentReference`() {
            // when
            val result = converter.convertJavaToJs("Project_DM/1", "DocumentReference", ctx)

            // then
            result.shouldBeInstanceOf<DocumentReference>()
            result.toString() shouldBe "Project_DM/1"
        }

        @ParameterizedTest(name = "should convert list for {0} param type")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverterTest#javaToJsArrayCases")
        fun `should convert list for array param type`(case: JavaToJsArrayCase) {
            // when
            val result = converter.convertJavaToJs(case.inputList, case.paramType, ctx)

            // then
            val jsArray = result!!.shouldBeInstanceOf<Value>()
            jsArray.arraySize shouldBe case.expectedSize.toLong()
        }

        @ParameterizedTest(name = "should support JS array methods on {0} param type")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverterTest#javaToJsArrayCases")
        fun `should support JS array methods on array param type`(case: JavaToJsArrayCase) {
            // given
            val jsArray = converter.convertJavaToJs(case.inputList, case.paramType, ctx) as Value

            // when
            val length = ctx.eval("js", "(function(arr) { return arr.length; })").execute(jsArray).asInt()

            // then
            length shouldBe case.expectedSize
        }

        @ParameterizedTest(name = "should throw naming the type but not the value when {0}")
        @MethodSource("com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverterTest#javaToJsTypeMismatchCases")
        fun `should throw naming the param type and the value type but never the value`(case: JavaToJsTypeMismatchCase) {
            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJavaToJs(case.input, case.paramType, ctx)
            }

            // then — the caller's own argument value must not be echoed back
            exception.message.shouldContain(case.paramType)
            case.expectedTypeName?.let { exception.message.shouldContain(it) }
            exception.message.shouldNotContain(case.forbiddenValueText)
        }

        @Test
        fun `should reject a map argument whose reference parts are null instead of building a reference from them`() {
            // given — a null part previously became the text "null" inside the reference
            val argument = mapOf("documentModelName" to "Project_DM", "documentId" to null)

            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJavaToJs(argument, "DocumentReference", ctx)
            }

            // then
            exception.message.shouldContain("DocumentReference")
        }

        @Test
        fun `should reject a malformed reference string instead of surfacing the value that was rejected`() {
            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJavaToJs("not-a-reference", "DocumentReference", ctx)
            }

            // then
            exception.message.shouldContain("DocumentReference")
            exception.message.shouldNotContain("not-a-reference")
        }

        @Test
        fun `should parse JSON string to JS array when param type is string array`() {
            // when
            val result = converter.convertJavaToJs("""["a","b","c"]""", "string[]", ctx)

            // then
            val jsArray = result!!.shouldBeInstanceOf<Value>()
            jsArray.arraySize shouldBe 3
            jsArray.getArrayElement(0).asString() shouldBe "a"
        }

        @Test
        fun `should parse JSON string to nested JS array when param type is nested number array`() {
            // when
            val result = converter.convertJavaToJs("[[1,2],[3,4]]", "number[][]", ctx)

            // then
            val jsArray = result!!.shouldBeInstanceOf<Value>()
            jsArray.arraySize shouldBe 2
            jsArray.getArrayElement(0).getArrayElement(0).asInt() shouldBe 1
        }

        @Test
        fun `should throw naming the param type but not the parsed JSON when JSON string is not an array`() {
            // when
            val exception = shouldThrow<IllegalArgumentException> {
                converter.convertJavaToJs("""{"secret":"s3cr3t"}""", "string[]", ctx)
            }

            // then — the JSON is the caller's own argument, so no part of it may be surfaced
            exception.message.shouldContain("string[]")
            exception.message.shouldNotContain("s3cr3t")
        }

        @Test
        fun `should throw when JSON string is malformed for array param type`() {
            // when / then
            shouldThrow<Exception> {
                converter.convertJavaToJs("[not json", "string[]", ctx)
            }
        }
    }
}
