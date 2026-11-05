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

import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.context.ScriptLocationIoAccessProvider
import com.mgmtp.a12.scripting.shared.internal.processing.eval.documentReferenceScriptTypeMapping
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.*

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
private class ScriptInvokerTest {

    private val engine: Engine = Engine.create("js")
    private val mappings = listOf(documentReferenceScriptTypeMapping)
    private val scriptInvoker: ScriptInvoker = ScriptInvoker(ScriptTypeConverter(mappings))
    private val ctx: Context = JsContextFactory(engine, mappings, ScriptLocationIoAccessProvider(emptyList())).createContext()

    @AfterAll
    fun tearDown() {
        ctx.close()
        engine.close()
    }

    companion object {
        private const val GREETING_SCRIPT = "(function() { return { greeting: 'hello' }; })"
        private const val WITH_PARAMS_SCRIPT = "(function(input) { return { greeting: 'Hello, ' + input.name }; })"
    }

    @Nested
    @DisplayName("Invoke script function")
    inner class InvokeScriptFunction {

        @Test
        fun `should invoke function without params and return output map`() {
            // given
            val scriptFn = ctx.eval("js", GREETING_SCRIPT)
            val returnProperties = linkedMapOf("greeting" to "string")

            // when
            val result = scriptInvoker.invokeScriptFunction(ctx, scriptFn, emptyMap(), returnProperties, emptyMap())

            // then
            result shouldBe mapOf("greeting" to "hello")
        }

        @Test
        fun `should pass arguments as params to function`() {
            // given
            val scriptFn = ctx.eval("js", WITH_PARAMS_SCRIPT)
            val params = linkedMapOf("name" to "string")
            val returnProperties = linkedMapOf("greeting" to "string")

            // when
            val result = scriptInvoker.invokeScriptFunction(ctx, scriptFn, params, returnProperties, mapOf("name" to "World"))

            // then
            result shouldBe mapOf("greeting" to "Hello, World")
        }

        @Test
        fun `should return empty map when returnProperties is empty`() {
            // given
            val scriptFn = ctx.eval("js", GREETING_SCRIPT)

            // when
            val result = scriptInvoker.invokeScriptFunction(ctx, scriptFn, emptyMap(), emptyMap(), emptyMap())

            // then
            result shouldBe emptyMap()
        }

        @Test
        fun `should throw when function returns null`() {
            // given
            val scriptFn = ctx.eval("js", "(function() { return null; })")
            val returnProperties = linkedMapOf("result" to "string")

            // when/then
            val exception = shouldThrow<IllegalStateException> {
                scriptInvoker.invokeScriptFunction(ctx, scriptFn, emptyMap(), returnProperties, emptyMap())
            }
            exception.message.shouldContain("Returning `null` from a business script is not allowed")
        }

        @Test
        fun `should throw naming the missing output property but not the script result`() {
            // given — the script returns 'hello', which the caller must not see echoed back
            val scriptFn = ctx.eval("js", GREETING_SCRIPT)
            val returnProperties = linkedMapOf("missing" to "string")

            // when/then
            val exception = shouldThrow<IllegalStateException> {
                scriptInvoker.invokeScriptFunction(ctx, scriptFn, emptyMap(), returnProperties, emptyMap())
            }
            exception.message.shouldContain("Return value 'missing' not found")
            exception.message.shouldNotContain("hello")
        }

        @Test
        fun `should handle multiple output properties`() {
            // given
            val scriptFn = ctx.eval("js", "(function() { return { name: 'test', count: 42 }; })")
            val returnProperties = linkedMapOf("name" to "string", "count" to "number")

            // when
            val result = scriptInvoker.invokeScriptFunction(ctx, scriptFn, emptyMap(), returnProperties, emptyMap())

            // then
            result shouldBe mapOf("name" to "test", "count" to 42)
        }
    }
}
