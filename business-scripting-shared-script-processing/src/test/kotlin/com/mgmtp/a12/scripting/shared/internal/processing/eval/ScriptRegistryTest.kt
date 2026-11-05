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

import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.context.ScriptLocationIoAccessProvider
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.*
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Path

private class ScriptRegistryTest {

    @TempDir
    lateinit var scriptsDirectory: Path

    private val engine: Engine = Engine.create("js")

    // Lazy throughout: every collaborator needs the injected temp directory, which only exists once the test starts.
    // Configuring the registry and the import sandbox from that same directory mirrors production, where both read
    // their locations from the one ScriptLocationResolver — a registered script always lies below a configured location.
    private val scriptingProperties: ScriptingProperties by lazy { ScriptingProperties(scriptLocations = listOf("file:$scriptsDirectory")) }
    private val scriptEvaluator: ScriptEvaluator by lazy {
        ScriptEvaluator(JsContextFactory(engine, emptyList(), ScriptLocationIoAccessProvider(listOf(scriptsDirectory))), ScriptTypeValidator())
    }

    // Subject under test
    private val scriptRegistry: ScriptRegistry by lazy { ScriptRegistry(scriptingProperties, scriptEvaluator, "test script") }

    @Nested
    @DisplayName("Script naming")
    inner class ScriptNaming {

        @TestFactory
        fun `should register correct identifier by convention based on file name`() = listOf(
            "read-test" to "readTest",
            "read_test" to "readTest",
            "convert_html_to_pdf" to "convertHtmlToPdf",
            "simple" to "simple",
            "mixed_separators-in-one_name" to "mixedSeparatorsInOneName",
            "double--dash" to "doubleDash",
            "camelCase" to "camelCase",
        ).map { (fileName, expectedIdentifier) ->
            DynamicTest.dynamicTest("$fileName.js should register as $expectedIdentifier") {
                // given
                val scriptFile = scriptsDirectory.resolve("$fileName.js").toFile()
                writeValidScript(scriptFile)

                // when
                val scriptIdentifier = scriptRegistry.register(scriptFile.toURI().toURL())

                // then
                scriptIdentifier shouldBe expectedIdentifier
            }
        }

        private fun writeValidScript(file: File) {
            file.writeText("function execute() {}; export { execute };")
        }
    }

    @Nested
    @DisplayName("Invalid Scripts")
    inner class InvalidScripts {

        @Test
        fun `should throw for script without function name`() {
            // when / then
            shouldThrow<IllegalArgumentException> {
                val scriptFile = scriptsDirectory.resolve("invalid-script.js").toFile()
                scriptFile.writeText("This is not a valid script!")
                scriptRegistry.register(scriptsDirectory.resolve("invalid-script.js").toUri().toURL())
            }
        }
    }

    @Nested
    @DisplayName("Hot reload enabled")
    inner class HotReloadEnabled {

        @BeforeEach
        fun setUp() {
            scriptingProperties.hotReload.enabled = true
        }

        @AfterEach
        fun cleanUp() {
            scriptingProperties.hotReload.enabled = false
        }

        @Test
        fun `should re-evaluate script when file changes`() {
            // given
            val scriptFile = scriptsDirectory.resolve("hot-reload.js").toFile()
            writeTemporaryScript(scriptFile, "Hello")
            val scriptIdentifier = scriptRegistry.register(scriptFile.toURI().toURL())
            scriptRegistry
                .get(scriptIdentifier)!!
                .source.characters
                .toString() shouldContain "Hello"

            // when
            writeTemporaryScript(scriptFile, "Hi")
            scriptFile.setLastModified(System.currentTimeMillis() + 2000)

            // then
            scriptRegistry
                .get(scriptIdentifier)!!
                .source.characters
                .toString() shouldContain "Hi"
        }

        @Test
        fun `should use cached version when reload fails`() {
            // given
            val scriptFile = scriptsDirectory.resolve("hot-reload-fallback.js").toFile()
            writeTemporaryScript(scriptFile, "Hello")
            val scriptIdentifier = scriptRegistry.register(scriptFile.toURI().toURL())

            // when
            scriptFile.writeText("this is not a valid script")
            scriptFile.setLastModified(System.currentTimeMillis() + 2000)

            // then
            scriptRegistry
                .get(scriptIdentifier)!!
                .source.characters
                .toString() shouldContain "Hello"
        }

        private fun writeTemporaryScript(file: File, greeting: String) {
            file.writeText(
                """
                function execute() {
                    return { greeting: "$greeting" };
                }
                execute.__returnProperties = {"greeting":"string"};

                export { execute };
                """.trimIndent(),
            )
        }
    }
}
