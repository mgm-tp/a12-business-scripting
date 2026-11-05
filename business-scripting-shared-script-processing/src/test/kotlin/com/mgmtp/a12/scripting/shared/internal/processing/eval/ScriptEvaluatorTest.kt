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

import com.mgmtp.a12.scripting.shared.internal.config.ScriptLocationResolver
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextConfiguration
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.comparables.shouldBeGreaterThanOrEqualTo
import io.kotest.matchers.comparables.shouldBeLessThanOrEqualTo
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.maps.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import java.net.URL
import java.nio.file.Path
import java.util.Base64
import kotlin.io.path.writeText
import kotlin.time.Clock

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
private class ScriptEvaluatorTest {

    private val engine: Engine = Engine.create("js")
    private val scriptsDirectory: Path = Path.of(SCRIPT_WITH_PARAMS_WITH_RETURN.toURI()).parent
    private val scriptingProperties = ScriptingProperties(scriptLocations = listOf("file:$scriptsDirectory"))
    private val ioAccessProvider = JsContextConfiguration().scriptLocationIoAccessProvider(ScriptLocationResolver(scriptingProperties.scriptLocations))
    private val scriptEvaluator = ScriptEvaluator(JsContextFactory(engine, emptyList(), ioAccessProvider), ScriptTypeValidator())

    @TempDir
    private lateinit var editableScriptsDirectory: Path

    private fun writeScript(fileName: String, content: String): Path = editableScriptsDirectory
        .resolve(fileName)
        .apply { writeText(content) }

    private fun evaluatorForEditableScripts(): ScriptEvaluator {
        val editableScriptsProperties = ScriptingProperties(scriptLocations = listOf("file:$editableScriptsDirectory"))
        val editableScriptsIoAccessProvider =
            JsContextConfiguration().scriptLocationIoAccessProvider(ScriptLocationResolver(editableScriptsProperties.scriptLocations))
        return ScriptEvaluator(JsContextFactory(engine, emptyList(), editableScriptsIoAccessProvider), ScriptTypeValidator())
    }

    companion object {
        private fun resource(path: String): URL = requireNotNull(ScriptEvaluatorTest::class.java.getResource(path)) { "Missing test resource: $path" }

        private val GREETING_SCRIPT =
            """
            function execute(input) {
                return { greeting: "Hello, " + input.name };
            }
            execute.__paramTypes = {"name":"string"};
            execute.__returnProperties = {"greeting":"string"};

            export { execute };
            """.trimIndent()
        private val EDITED_GREETING_SCRIPT = GREETING_SCRIPT.replace("Hello, ", "Welcome, ")

        private val SOURCE_MAP_JSON = """{"version":3,"sources":["greeting.ts"],"mappings":"AAAA","names":[]}"""
        private val INLINE_SOURCE_MAP_COMMENT =
            "//# sourceMappingURL=data:application/json;base64,${Base64.getEncoder().encodeToString(SOURCE_MAP_JSON.toByteArray())}"
        private const val UNDECODABLE_SOURCE_MAP_COMMENT = "//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjoz!"

        private val SCRIPT_WITH_PARAMS_WITH_RETURN = resource("/scripts/with-params-with-return.js")
        private val SCRIPT_NO_PARAMS_WITH_RETURN = resource("/scripts/no-params-with-return.js")
        private val SCRIPT_WITH_PARAMS_NO_RETURN = resource("/scripts/with-params-no-return.js")
        private val SCRIPT_NO_PARAMS_NO_RETURN = resource("/scripts/no-params-no-return.js")
        private val SCRIPT_WITHOUT_ENTRY_FUNCTION_EXPORT = resource("/scripts/no-entry-function-export.js")
        private val SCRIPT_MULTI_ENTRY = resource("/scripts/multi-entry-params.js")
        private val SCRIPT_SYNTAX_ERROR = resource("/scripts/syntax-error.js")
    }

    @AfterAll
    fun tearDown() {
        engine.close()
    }

    @Nested
    inner class ParamTypes {

        @Test
        fun `should extract param types from script`() {
            // when
            val result = scriptEvaluator.parse(SCRIPT_WITH_PARAMS_WITH_RETURN)

            // then
            result.params shouldContainExactly mapOf("name" to "string")
        }

        @Test
        fun `should return empty params when script declares no param types`() {
            // when
            val result = scriptEvaluator.parse(SCRIPT_NO_PARAMS_WITH_RETURN)

            // then
            result.params.shouldBeEmpty()
        }

        @Test
        fun `should preserve declaration order of param types`() {
            // when
            val result = scriptEvaluator.parse(SCRIPT_MULTI_ENTRY)

            // then
            result.params.keys.toList() shouldBe listOf("firstName", "lastName", "age")
        }
    }

    @Nested
    inner class ReturnProperties {

        @Test
        fun `should extract return properties from script`() {
            // when
            val result = scriptEvaluator.parse(SCRIPT_WITH_PARAMS_WITH_RETURN)

            // then
            result.returnProperties shouldContainExactly mapOf("greeting" to "string")
        }

        @Test
        fun `should return empty return properties when script declares no return`() {
            // when
            val result = scriptEvaluator.parse(SCRIPT_WITH_PARAMS_NO_RETURN)

            // then
            result.returnProperties.shouldBeEmpty()
        }
    }

    @Nested
    inner class ScriptSource {

        @Test
        fun `should set source name to the script file name`() {
            // when
            val result = scriptEvaluator.parse(SCRIPT_WITH_PARAMS_WITH_RETURN)

            // then
            result.source.name shouldBe "with-params-with-return.js"
        }
    }

    /**
     * The debugger identifies a script by the URI of its source. It must stay the script's file URI
     * across re-parses, otherwise breakpoints stop binding after a hot reload.
     */
    @Nested
    inner class ScriptSourceIdentity {

        @Test
        fun `should identify the source by the script file URI`() {
            // given
            val scriptFile = writeScript("greeting.js", GREETING_SCRIPT)

            // when
            val result = evaluatorForEditableScripts().parse(scriptFile.toUri().toURL())

            // then
            result.source.uri shouldBe scriptFile.toUri()
        }

        @Test
        fun `should keep the source URI unchanged when the script content changed`() {
            // given
            val scriptFile = writeScript("edited-greeting.js", GREETING_SCRIPT)
            val scriptEvaluator = evaluatorForEditableScripts()
            val uriBeforeEdit = scriptEvaluator.parse(scriptFile.toUri().toURL()).source.uri

            // when
            scriptFile.writeText(EDITED_GREETING_SCRIPT)

            // then
            scriptEvaluator.parse(scriptFile.toUri().toURL()).source.uri shouldBe uriBeforeEdit
        }
    }

    /** The engine resolves a failing line through the inline map esbuild writes into the script. */
    @Nested
    inner class InlineSourceMap {

        @Test
        fun `should expose the inline source map of a script built with one`() {
            // given
            val scriptFile = writeScript("mapped-greeting.js", "$GREETING_SCRIPT\n$INLINE_SOURCE_MAP_COMMENT")

            // when
            val result = evaluatorForEditableScripts().parse(scriptFile.toUri().toURL())

            // then
            result.sourceMap shouldBe SOURCE_MAP_JSON
        }

        @Test
        fun `should expose no source map for a script built without one`() {
            // given
            val scriptFile = writeScript("unmapped-greeting.js", GREETING_SCRIPT)

            // when / then
            evaluatorForEditableScripts().parse(scriptFile.toUri().toURL()).sourceMap.shouldBeNull()
        }

        @Test
        @ExtendWith(OutputCaptureExtension::class)
        fun `should parse a script whose inline source map cannot be decoded, warning without a source map`(capturedOutput: CapturedOutput) {
            // given - a truncated build: '!' is no base64 character, so the map cannot be decoded
            val scriptFile = writeScript("broken-map-greeting.js", "$GREETING_SCRIPT\n$UNDECODABLE_SOURCE_MAP_COMMENT")

            // when
            val result = evaluatorForEditableScripts().parse(scriptFile.toUri().toURL())

            // then - the script still registers; only its failures lose the script line
            result.sourceMap.shouldBeNull()
            val warning = capturedOutput.toString().lineSequence().single { "broken-map-greeting.js" in it }
            warning shouldContain "WARN"
            warning shouldNotContain scriptFile.parent.toString()
        }
    }

    @Nested
    inner class ParseTimestamp {

        @Test
        fun `should set lastParsed to current time`() {
            // given
            val before = Clock.System.now()

            // when
            val result = scriptEvaluator.parse(SCRIPT_NO_PARAMS_NO_RETURN)
            val after = Clock.System.now()

            // then
            result.lastParsed shouldBeGreaterThanOrEqualTo before
            result.lastParsed shouldBeLessThanOrEqualTo after
        }
    }

    @Nested
    inner class ErrorHandling {

        @Test
        fun `should throw naming the script file but no path when script has no entry function export`() {
            // when
            val exception = shouldThrow<IllegalArgumentException> {
                scriptEvaluator.parse(SCRIPT_WITHOUT_ENTRY_FUNCTION_EXPORT)
            }

            // then
            exception.message shouldContain "has no specified entry function"
            exception.message shouldContain "no-entry-function-export.js"
            exception.message.shouldNotContainAnyPathComponent()
        }

        @Test
        fun `should throw naming the script file but no path when script has a syntax error`() {
            // when — the parse failure text originates in the script engine
            val exception = shouldThrow<IllegalArgumentException> {
                scriptEvaluator.parse(SCRIPT_SYNTAX_ERROR)
            }

            // then
            exception.message shouldContain "syntax-error.js"
            exception.message.shouldNotContainAnyPathComponent()
        }

        private fun String?.shouldNotContainAnyPathComponent() {
            this shouldNotContain "/"
            this shouldNotContain "file:"
        }
    }
}
