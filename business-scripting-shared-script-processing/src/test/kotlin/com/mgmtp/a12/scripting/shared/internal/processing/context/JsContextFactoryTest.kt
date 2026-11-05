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

package com.mgmtp.a12.scripting.shared.internal.processing.context

import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import com.mgmtp.a12.scripting.shared.api.stringFieldOrNull
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.PolyglotException
import org.graalvm.polyglot.Source
import org.graalvm.polyglot.Value
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.DisabledOnOs
import org.junit.jupiter.api.condition.OS
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

private class JsContextFactoryTest {

    private val engine = Engine.create("js")

    private data class Wrapped(val raw: String)

    companion object {
        private const val MARKER_SCRIPT_NAME = "marker.js"
        private const val CONTEXTS_PER_SCRIPT_DIRECTORY = 4
        private const val CONCURRENT_CONTEXT_TIMEOUT_SECONDS = 30L
    }

    @AfterEach
    fun closeEngine() {
        engine.close()
    }

    private fun factoryWithScriptsDirectories(vararg scriptsDirectories: Path) = jsContextFactoryWithScriptsDirectories(engine, *scriptsDirectories)

    private fun writeMarkerScriptExporting(scriptDirectory: Path, answer: Int) {
        Files.writeString(scriptDirectory.resolve(MARKER_SCRIPT_NAME), "export const answer = $answer;")
    }

    private fun scriptImporting(markerScriptSpecifier: String): Source = Source
        .newBuilder("js", "export { answer } from '$markerScriptSpecifier';", "entry.mjs")
        .mimeType("application/javascript+module")
        .build()

    private fun readMarkerAnswer(factory: JsContextFactory, scriptDirectory: Path): Int = factory
        .createContext(currentWorkingDirectory = scriptDirectory)
        .use { context -> context.eval(scriptImporting("./$MARKER_SCRIPT_NAME")).getMember("answer").asInt() }

    @Test
    fun `should build context with no mappings and execute basic JS`() {
        factoryWithScriptsDirectories().createContext().use { context ->
            context.eval("js", "1 + 1").asInt() shouldBe 2
        }
    }

    @Test
    fun `should convert Value via targetTypeMapping for output-only mapping`() {
        // given
        val mapping = ScriptTypeMapping(
            typeName = "Wrapped",
            targetType = Wrapped::class.java,
            parseOutput = { value -> value.takeIf(Value::isString)?.asString()?.let(::Wrapped) },
        )
        JsContextFactory(engine, listOf(mapping), ScriptLocationIoAccessProvider(emptyList())).createContext().use { context ->
            // when
            val result = context.eval("js", "'hello'").`as`(Wrapped::class.java)

            // then
            result shouldBe Wrapped("hello")
        }
    }

    @Test
    fun `should have targetTypeMappings set on context`() {
        // given
        val mapping = ScriptTypeMapping(
            typeName = "Wrapped",
            targetType = Wrapped::class.java,
            parseOutput = { value -> value.stringFieldOrNull("raw")?.let(::Wrapped) },
        )
        JsContextFactory(engine, listOf(mapping), ScriptLocationIoAccessProvider(emptyList())).createContext().use { context ->
            // when
            val result = context.eval("js", "({ raw: 'hello' })").`as`(Wrapped::class.java)

            // then
            result shouldBe Wrapped("hello")
        }
    }

    @Test
    fun `should create independent contexts on multiple createContext calls`() {
        val factory = factoryWithScriptsDirectories()
        factory.createContext().use { ctx1 ->
            factory.createContext().use { ctx2 ->
                // given
                ctx1.eval("js", "var x = 42;")

                // when / then
                ctx1.eval("js", "x").asInt() shouldBe 42
                ctx2.eval("js", "typeof x").asString() shouldBe "undefined"
            }
        }
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    fun `should give a script file access to the scripts directory it lies in`(@TempDir scriptsDirectory: Path) {
        // given
        writeMarkerScriptExporting(scriptsDirectory, 42)
        val factory = factoryWithScriptsDirectories(scriptsDirectory)

        // when / then
        readMarkerAnswer(factory, scriptsDirectory) shouldBe 42
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    fun `should resolve a relative import against the script directory the context was created for`(@TempDir scriptsDirectory: Path) {
        // given — the script lies one level below the scripts directory and imports upwards
        writeMarkerScriptExporting(scriptsDirectory, 42)
        val factory = factoryWithScriptsDirectories(scriptsDirectory)

        // when
        factory.createContext(currentWorkingDirectory = scriptsDirectory.resolve("child")).use { context ->
            // then
            context.eval(scriptImporting("../$MARKER_SCRIPT_NAME")).getMember("answer").asInt() shouldBe 42
        }
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    fun `should deny all file access when no script directory is given`(@TempDir scriptsDirectory: Path) {
        // given
        writeMarkerScriptExporting(scriptsDirectory, 42)
        val factory = factoryWithScriptsDirectories(scriptsDirectory)

        // when
        factory.createContext().use { contextWithoutScriptDirectory ->
            // then — not even the configured scripts directory is readable by its absolute path
            shouldThrow<PolyglotException> {
                contextWithoutScriptDirectory.eval(scriptImporting(scriptsDirectory.resolve(MARKER_SCRIPT_NAME).toString()))
            }
        }
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    fun `should deny a script in one location access to a file in another configured location`(
        @TempDir firstScriptLocation: Path,
        @TempDir secondScriptLocation: Path,
    ) {
        // given — both directories are configured locations, each holding its own marker script
        writeMarkerScriptExporting(firstScriptLocation, 1)
        writeMarkerScriptExporting(secondScriptLocation, 2)
        val factory = factoryWithScriptsDirectories(firstScriptLocation, secondScriptLocation)
        val markerInSecondLocation = secondScriptLocation.resolve(MARKER_SCRIPT_NAME)

        // when / then — reaching into the other configured location is denied, by absolute path
        factory.createContext(currentWorkingDirectory = firstScriptLocation).use { context ->
            shouldThrow<PolyglotException> { context.eval(scriptImporting(markerInSecondLocation.toString())) }
        }

        // when / then — and by traversing out of its own location
        val traversalToSecondLocation = "../${secondScriptLocation.fileName}/$MARKER_SCRIPT_NAME"
        factory.createContext(currentWorkingDirectory = firstScriptLocation).use { context ->
            shouldThrow<PolyglotException> { context.eval(scriptImporting(traversalToSecondLocation)) }
        }

        // then — while each location keeps access to its own marker
        readMarkerAnswer(factory, firstScriptLocation) shouldBe 1
        readMarkerAnswer(factory, secondScriptLocation) shouldBe 2
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    fun `should not leak the working directory of a previous createContext call`(@TempDir scriptsDirectory: Path) {
        // given — the marker script is only resolvable while the scripts directory is the working directory
        writeMarkerScriptExporting(scriptsDirectory, 42)
        val factory = factoryWithScriptsDirectories(scriptsDirectory)
        readMarkerAnswer(factory, scriptsDirectory) shouldBe 42

        // when — a context is created without a script directory
        factory.createContext().use { contextWithoutScriptDirectory ->
            // then — it does not inherit the working directory of the previous context
            shouldThrow<PolyglotException> { contextWithoutScriptDirectory.eval(scriptImporting("./$MARKER_SCRIPT_NAME")) }
        }
    }

    @Test
    @DisabledOnOs(OS.WINDOWS)
    fun `should give each concurrently created context its own working directory`(@TempDir scriptsDirectory: Path) {
        // given — two script subdirectories, each with a marker script exporting a distinct answer
        val answerByScriptSubdirectory = (1..2).associate { subdirectoryNumber ->
            Files.createDirectory(scriptsDirectory.resolve("sub$subdirectoryNumber")) to subdirectoryNumber
        }
        answerByScriptSubdirectory.forEach(::writeMarkerScriptExporting)
        val factory = factoryWithScriptsDirectories(scriptsDirectory)
        val contextCreations = answerByScriptSubdirectory.keys.flatMap { scriptSubdirectory ->
            List(CONTEXTS_PER_SCRIPT_DIRECTORY) { scriptSubdirectory }
        }
        val startTogether = CyclicBarrier(contextCreations.size)
        val executor = Executors.newFixedThreadPool(contextCreations.size)

        try {
            // when — every context is created at the same moment from the same factory
            val answerReadByEachContext = contextCreations
                .map { scriptSubdirectory ->
                    executor.submit<Pair<Path, Int>> {
                        startTogether.await()
                        scriptSubdirectory to readMarkerAnswer(factory, scriptSubdirectory)
                    }
                }.map { it.get(CONCURRENT_CONTEXT_TIMEOUT_SECONDS, TimeUnit.SECONDS) }

            // then — every context resolved the marker script of its own subdirectory
            answerReadByEachContext.forEach { (scriptSubdirectory, answer) ->
                answer shouldBe answerByScriptSubdirectory.getValue(scriptSubdirectory)
            }
        } finally {
            executor.shutdownNow()
        }
    }
}
