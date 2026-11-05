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

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.string.shouldContain
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.PolyglotException
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.DisabledOnOs
import org.junit.jupiter.api.condition.OS
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

/**
 * Covers what a script may *name*, which is the boundary the lookup predicate draws. It is not a containment
 * suite: host interop still reaches these capabilities through `getClass()` on any object a script holds.
 */
private class ScriptSandboxRestrictionsTest {

    private val engine = Engine.create("js")

    companion object {
        private const val HOST_CLASS_LOOKUP_REJECTION = "is not allowed or does not exist"

        private const val READING_A_FILE = "Java.type('java.nio.file.Files').readString(Java.type('java.nio.file.Path').of('/etc/hostname'))"
        private const val WRITING_A_FILE = "Java.type('java.nio.file.Files').writeString(Java.type('java.nio.file.Path').of('/tmp/probe'), 'x')"
        private const val STARTING_A_PROCESS = "new (Java.type('java.lang.ProcessBuilder'))('/bin/echo').start()"
        private const val RUNNING_A_COMMAND = "Java.type('java.lang.Runtime').getRuntime().exec('/bin/echo')"
        private const val READING_AN_ENVIRONMENT_VARIABLE = "Java.type('java.lang.System').getenv('PATH')"
        private const val OPENING_AN_OUTBOUND_SOCKET = "new (Java.type('java.net.Socket'))('localhost', 80)"
    }

    @AfterEach
    fun closeEngine() {
        engine.close()
    }

    private fun rejectionMessageFor(javaScript: String): String = jsContextFactoryWithScriptsDirectories(engine).createContext().use { context ->
        shouldThrow<PolyglotException> { context.eval("js", javaScript) }.message.orEmpty()
    }

    @Nested
    inner class LookupOfCapabilityBearingClasses {

        @Test
        fun `should deny reading a file outside the script location`() {
            rejectionMessageFor(READING_A_FILE) shouldContain HOST_CLASS_LOOKUP_REJECTION
        }

        @Test
        fun `should deny writing a file`() {
            rejectionMessageFor(WRITING_A_FILE) shouldContain HOST_CLASS_LOOKUP_REJECTION
        }

        @Test
        fun `should deny starting a process`() {
            rejectionMessageFor(STARTING_A_PROCESS) shouldContain HOST_CLASS_LOOKUP_REJECTION
        }

        @Test
        fun `should deny running a command through the runtime`() {
            rejectionMessageFor(RUNNING_A_COMMAND) shouldContain HOST_CLASS_LOOKUP_REJECTION
        }

        @Test
        fun `should deny reading an environment variable`() {
            rejectionMessageFor(READING_AN_ENVIRONMENT_VARIABLE) shouldContain HOST_CLASS_LOOKUP_REJECTION
        }

        @Test
        fun `should deny opening an outbound socket`() {
            rejectionMessageFor(OPENING_AN_OUTBOUND_SOCKET) shouldContain HOST_CLASS_LOOKUP_REJECTION
        }
    }

    /** `load()` reads a file without looking up a host class, so `ScriptLocationFileSystem` is what covers it. */
    @Nested
    inner class FileReadsThatNameNoHostClass {

        @Test
        @DisabledOnOs(OS.WINDOWS)
        fun `should deny loading a file outside the script location`(
            @TempDir scriptsDirectory: Path,
            @TempDir otherDirectory: Path,
        ) {
            // given
            val fileOutsideScriptLocation = otherDirectory.resolve("outside.js")
            Files.writeString(fileOutsideScriptLocation, "var loaded = true;")

            // when / then
            jsContextFactoryWithScriptsDirectories(engine, scriptsDirectory)
                .createContext(currentWorkingDirectory = scriptsDirectory)
                .use { context ->
                    shouldThrow<PolyglotException> { context.eval("js", "load('$fileOutsideScriptLocation')") }
                }
        }
    }

    @Nested
    inner class ContextSettings {

        private fun contextLookingUpAllowlistedClassesOnly(configure: Context.Builder.() -> Context.Builder): Context = Context
            .newBuilder("js")
            .engine(engine)
            .configure()
            .build()

        @Test
        fun `should deny a script the polyglot builtin`() {
            jsContextFactoryWithScriptsDirectories(engine).createContext().use { context ->
                shouldThrow<PolyglotException> { context.eval("js", "Polyglot.eval('js', '1')") }
                    .message shouldContain "Polyglot is not defined"
            }
        }

        @Test
        fun `should keep the lookup predicate regardless of its order against allowAllAccess`() {
            // given — the two orders in which a later change could add blanket access next to the predicate
            val predicateBeforeAllAccess = contextLookingUpAllowlistedClassesOnly {
                allowHostClassLookup(ScriptAccessibleJavaClasses::isAccessible).allowAllAccess(true)
            }
            val predicateAfterAllAccess = contextLookingUpAllowlistedClassesOnly {
                allowAllAccess(true).allowHostClassLookup(ScriptAccessibleJavaClasses::isAccessible)
            }

            // when / then — the predicate wins either way, so blanket access cannot silently widen the lookup
            listOf(predicateBeforeAllAccess, predicateAfterAllAccess).forEach { context ->
                context.use {
                    shouldThrow<PolyglotException> { it.eval("js", "Java.type('java.lang.ProcessBuilder')") }
                        .message shouldContain HOST_CLASS_LOOKUP_REJECTION
                }
            }
        }
    }
}
