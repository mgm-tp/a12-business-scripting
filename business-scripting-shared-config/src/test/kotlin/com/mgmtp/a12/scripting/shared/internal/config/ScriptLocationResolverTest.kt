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

package com.mgmtp.a12.scripting.shared.internal.config

import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.string.shouldInclude
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import org.springframework.core.io.UrlResource
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import org.springframework.core.io.support.ResourcePatternResolver
import java.net.URI
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path

@ExtendWith(OutputCaptureExtension::class)
private class ScriptLocationResolverTest {

    companion object {
        const val SCRIPTS_DIRECTORY_NAME = "scripts"
        const val CLASSPATH_SCRIPTS_LOCATION = "classpath:$SCRIPTS_DIRECTORY_NAME"
        const val TOP_LEVEL_SCRIPT_NAME = "top-level.js"
        const val NESTED_SCRIPT_NAME = "nested.js"
        const val SUBDIRECTORY_NAME = "sub"
    }

    private fun fileLocationOf(directory: Path) = "file:$directory"

    @Nested
    inner class ResolvedResources {

        @Test
        fun `should resolve every script below a location, including nested ones`(@TempDir scriptLocation: Path) {
            // given
            Files.writeString(scriptLocation.resolve(TOP_LEVEL_SCRIPT_NAME), "")
            val subdirectory = Files.createDirectory(scriptLocation.resolve(SUBDIRECTORY_NAME))
            Files.writeString(subdirectory.resolve(NESTED_SCRIPT_NAME), "")

            // when
            val resolvedResources = ScriptLocationResolver(listOf(fileLocationOf(scriptLocation))).resolveResources()

            // then
            resolvedResources.map { it.filename } shouldContainExactlyInAnyOrder
                listOf(TOP_LEVEL_SCRIPT_NAME, SUBDIRECTORY_NAME, NESTED_SCRIPT_NAME)
        }

        @Test
        fun `should also resolve non-script files so the registration filter stays the single rule`(@TempDir scriptLocation: Path) {
            // given
            Files.writeString(scriptLocation.resolve("notes.txt"), "")

            // when
            val resolvedResources = ScriptLocationResolver(listOf(fileLocationOf(scriptLocation))).resolveResources()

            // then
            resolvedResources.map { it.filename } shouldContainExactly listOf("notes.txt")
        }

        @Test
        fun `should treat a location with and without a trailing slash identically`(@TempDir scriptLocation: Path) {
            // given
            Files.writeString(scriptLocation.resolve(TOP_LEVEL_SCRIPT_NAME), "")

            // when
            val withoutTrailingSlash = ScriptLocationResolver(listOf(fileLocationOf(scriptLocation)))
            val withTrailingSlash = ScriptLocationResolver(listOf("${fileLocationOf(scriptLocation)}/"))

            // then
            withTrailingSlash.resolveResources().map { it.filename } shouldContainExactly
                withoutTrailingSlash.resolveResources().map { it.filename }
            withTrailingSlash.fileSystemRootDirectories shouldContainExactly withoutTrailingSlash.fileSystemRootDirectories
        }

        @Test
        fun `should resolve scripts from every configured location`(@TempDir firstLocation: Path, @TempDir secondLocation: Path) {
            // given
            Files.writeString(firstLocation.resolve(TOP_LEVEL_SCRIPT_NAME), "")
            Files.writeString(secondLocation.resolve(NESTED_SCRIPT_NAME), "")

            // when
            val resolvedResources = ScriptLocationResolver(listOf(fileLocationOf(firstLocation), fileLocationOf(secondLocation)))
                .resolveResources()

            // then
            resolvedResources.map { it.filename } shouldContainExactlyInAnyOrder listOf(TOP_LEVEL_SCRIPT_NAME, NESTED_SCRIPT_NAME)
        }
    }

    @Nested
    inner class FileSystemRootDirectories {

        @Test
        fun `should resolve a file location to its directory on disk`(@TempDir scriptLocation: Path) {
            ScriptLocationResolver(listOf(fileLocationOf(scriptLocation))).fileSystemRootDirectories shouldContainExactly
                listOf(scriptLocation.toAbsolutePath().normalize())
        }

        @Test
        fun `should resolve a classpath location to its directory on disk`(@TempDir classpathRoot: Path) {
            // given — a scripts directory on the classpath, laid out exploded exactly like a deployed application
            val scriptsDirectoryOnClasspath = Files.createDirectory(classpathRoot.resolve(SCRIPTS_DIRECTORY_NAME))
            Files.writeString(scriptsDirectoryOnClasspath.resolve(TOP_LEVEL_SCRIPT_NAME), "")

            URLClassLoader(arrayOf(classpathRoot.toUri().toURL())).use { classLoaderContainingScriptsDirectory ->
                // when
                val resolver = ScriptLocationResolver(
                    listOf(CLASSPATH_SCRIPTS_LOCATION),
                    PathMatchingResourcePatternResolver(classLoaderContainingScriptsDirectory),
                )

                // then
                resolver.fileSystemRootDirectories shouldContainExactly listOf(scriptsDirectoryOnClasspath.toAbsolutePath().normalize())
            }
        }

        @Test
        fun `should return a file-backed root for a file location that does not exist yet, and warn naming it`(
            @TempDir parentDirectory: Path,
            capturedOutput: CapturedOutput,
        ) {
            // given
            val missingScriptLocation = parentDirectory.resolve("not-created-yet")

            // when
            val resolver = ScriptLocationResolver(listOf(fileLocationOf(missingScriptLocation)))

            // then — a location that appears later is a valid sandbox root from the start
            resolver.fileSystemRootDirectories shouldContainExactly listOf(missingScriptLocation.toAbsolutePath().normalize())
            capturedOutput.toString() shouldInclude missingScriptLocation.toString()
            capturedOutput.toString() shouldInclude "does not exist yet"
        }

        @Test
        fun `should return no root for a classpath location that does not exist, and warn naming it`(capturedOutput: CapturedOutput) {
            // given
            val missingScriptLocation = "classpath:no-such-directory-in-this-module"

            // when
            val resolver = ScriptLocationResolver(listOf(missingScriptLocation))

            // then — a classpath location that does not resolve has no directory that could become a root
            resolver.fileSystemRootDirectories.shouldBeEmpty()
            capturedOutput.toString() shouldInclude missingScriptLocation
            capturedOutput.toString() shouldInclude "resolves to nothing"
        }

        @Test
        fun `should return no root and warn that a location inside a jar is not watchable`(capturedOutput: CapturedOutput) {
            // given
            val resourcePatternResolver = mockk<ResourcePatternResolver>()
            every { resourcePatternResolver.getResources("$CLASSPATH_SCRIPTS_LOCATION/") } returns
                arrayOf(UrlResource(URI.create("jar:file:/app/application.jar!/scripts/")))

            // when
            val resolver = ScriptLocationResolver(listOf(CLASSPATH_SCRIPTS_LOCATION), resourcePatternResolver)

            // then
            resolver.fileSystemRootDirectories.shouldBeEmpty()
            capturedOutput.toString() shouldInclude CLASSPATH_SCRIPTS_LOCATION
            capturedOutput.toString() shouldInclude "not watchable"
        }

        @Test
        fun `should keep only the outer root when one configured location is nested in another`(@TempDir outerLocation: Path) {
            // given
            val nestedLocation = Files.createDirectory(outerLocation.resolve("nested"))

            // when
            val resolver = ScriptLocationResolver(listOf(fileLocationOf(outerLocation), fileLocationOf(nestedLocation)))

            // then
            resolver.fileSystemRootDirectories shouldContainExactly listOf(outerLocation.toAbsolutePath().normalize())
        }

        @Test
        fun `should keep both roots when one location name is a string prefix of the other`(@TempDir parentDirectory: Path) {
            // given — 'scripts-legacy' starts with 'scripts' as a string but is not below it as a path
            val scriptsLocation = Files.createDirectory(parentDirectory.resolve("scripts"))
            val legacyScriptsLocation = Files.createDirectory(parentDirectory.resolve("scripts-legacy"))

            // when
            val resolver = ScriptLocationResolver(listOf(fileLocationOf(scriptsLocation), fileLocationOf(legacyScriptsLocation)))

            // then
            resolver.fileSystemRootDirectories shouldContainExactlyInAnyOrder
                listOf(scriptsLocation.toAbsolutePath().normalize(), legacyScriptsLocation.toAbsolutePath().normalize())
        }

        @Test
        fun `should keep a location configured twice only once`(@TempDir scriptLocation: Path) {
            val resolver = ScriptLocationResolver(listOf(fileLocationOf(scriptLocation), "${fileLocationOf(scriptLocation)}/"))

            resolver.fileSystemRootDirectories shouldContainExactly listOf(scriptLocation.toAbsolutePath().normalize())
        }
    }
}
