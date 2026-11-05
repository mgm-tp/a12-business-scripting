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

package com.mgmtp.a12.scripting.shared.internal.loading

import com.mgmtp.a12.scripting.shared.internal.config.ScriptLocationResolver
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldInclude
import io.kotest.matchers.string.shouldNotInclude
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.awaitility.Awaitility.await
import org.junit.jupiter.api.*
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import java.net.URL
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration

@ExtendWith(OutputCaptureExtension::class)
private class ScriptLoaderTest {

    companion object {
        const val CHUNK_PREFIX = "shared-lib-"
        const val SCRIPT_TYPE_DESCRIPTION = "test script"
        const val AUTOLOAD_TIMEOUT_MS = 2000L
        const val AUTOLOAD_POLL_INTERVAL_MS = 50L

        // A location that does not exist yet is only re-checked once per watch tick, so it needs a longer window
        const val PENDING_LOCATION_TIMEOUT_MS = 8000L

        // Resolves to a classpath resource that has no URL at all, so it yields neither a watchable nor a pending root
        const val UNRESOLVABLE_CLASSPATH_LOCATION = "classpath:this-directory-does-not-exist-xyz"

        fun fileLocationOf(directory: Path) = "file:$directory"
    }

    @TempDir
    lateinit var scriptsDir: Path

    private lateinit var registerScript: (URL) -> Unit
    private lateinit var scriptLoader: ScriptLoader

    @BeforeEach
    fun setUp() {
        registerScript = mockk(relaxed = true)
        // The watcher-focused tests turn the startup scan off so that every registration they assert comes from a watch event
        scriptLoader = createLoader(registerExistingScriptsAtStartup = false)
    }

    @AfterEach
    fun tearDown() {
        if (scriptLoader.isRunning) scriptLoader.stop()
    }

    private fun createLoader(
        scriptLocations: List<String> = listOf(fileLocationOf(scriptsDir)),
        registerExistingScriptsAtStartup: Boolean = true,
        watchForNewScripts: Boolean = true,
    ): ScriptLoader = ScriptLoader(
        scriptLocationResolver = ScriptLocationResolver(scriptLocations),
        chunkNamePrefixes = listOf(CHUNK_PREFIX),
        scriptTypeDescription = SCRIPT_TYPE_DESCRIPTION,
        registerExistingScriptsAtStartup = registerExistingScriptsAtStartup,
        watchForNewScripts = watchForNewScripts,
        register = registerScript,
    )

    // Sentinel pattern: to assert a file was NOT registered, write a valid .js sentinel file alongside
    // it. awaitRegistration polls until the sentinel is registered, confirming the watcher is active.
    // Filtered files (chunk-prefixed, non-.js) can never call registerScript regardless of event
    // delivery order, so the negative assertion is safe once the sentinel is registered.
    private fun awaitRegistration(expectedCallCount: Int, timeoutMs: Long = AUTOLOAD_TIMEOUT_MS) {
        await()
            .atMost(Duration.ofMillis(timeoutMs))
            .pollInterval(Duration.ofMillis(AUTOLOAD_POLL_INTERVAL_MS))
            .untilAsserted {
                verify(exactly = expectedCallCount) { registerScript(any()) }
            }
    }

    @Nested
    @DisplayName("File Registration")
    inner class FileRegistration {

        @BeforeEach
        fun startWatcher() {
            scriptLoader.start()
        }

        @Test
        fun `should register new js file placed in watched directory`() {
            // given
            val scriptFile = scriptsDir.resolve("my-script.js").toFile()

            // when
            scriptFile.writeText("function execute() {}")

            // then
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
        }

        @Test
        fun `should not register chunk-prefixed js file`() {
            // given
            val chunkFile = scriptsDir.resolve("${CHUNK_PREFIX}abc123.js").toFile()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()

            // when — write chunk first, then sentinel to confirm the chunk event was processed
            chunkFile.writeText("export const x = 1")
            sentinelFile.writeText("function execute() {}")

            // then — sentinel registered, chunk skipped
            awaitRegistration(1)
            verify(exactly = 0) { registerScript(chunkFile.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }

        @Test
        fun `should not register non-js file`() {
            // given
            val tsFile = scriptsDir.resolve("my-script.ts").toFile()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()

            // when — write non-js first, then sentinel to confirm the non-js event was processed
            tsFile.writeText("export function execute() {}")
            sentinelFile.writeText("function execute() {}")

            // then — sentinel registered, ts file skipped
            awaitRegistration(1)
            verify(exactly = 0) { registerScript(tsFile.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }

        @Test
        fun `should not register file with test suffix`() {
            // given
            val testFile = scriptsDir.resolve("my-script.test.js").toFile()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()

            // when — write test file first, then sentinel to confirm the test-file event was processed
            testFile.writeText("function execute() {}")
            sentinelFile.writeText("function execute() {}")

            // then — sentinel registered, test file skipped
            awaitRegistration(1)
            verify(exactly = 0) { registerScript(testFile.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }

        @Test
        fun `should register a script only once when duplicate ENTRY_CREATE events are received`() {
            // given
            val scriptFile = scriptsDir.resolve("my-script.js").toFile()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()
            scriptFile.writeText("function execute() {}")
            awaitRegistration(1)

            // when — delete and recreate triggers a second ENTRY_CREATE for the same path
            scriptFile.delete()
            scriptFile.writeText("function execute() {}")
            // write sentinel after the recreated file to confirm the second event was processed
            sentinelFile.writeText("function execute() {}")
            awaitRegistration(2)

            // then — script registered once, sentinel registered once (two total, not three)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }

        @Test
        fun `should not track path when registerScript throws and should retry on next ENTRY_CREATE`(capturedOutput: CapturedOutput) {
            // given
            val scriptFile = scriptsDir.resolve("my-script.js").toFile()
            every { registerScript(scriptFile.toURI().toURL()) } throws IllegalArgumentException("invalid") andThen Unit

            // when — first attempt fails
            scriptFile.writeText("function execute() {}")
            // wait for the first (failing) call before triggering retry
            awaitRegistration(1)

            // when — retry via delete and recreate
            scriptFile.delete()
            scriptFile.writeText("function execute() {}")

            // then — registerScript called twice (first fails, second succeeds), failure logged as a warning
            awaitRegistration(2)
            capturedOutput.toString() shouldInclude "Failed to register"
        }

        @Test
        fun `should name the script file but not its directory when registration fails`(capturedOutput: CapturedOutput) {
            // given
            val scriptFile = scriptsDir.resolve("my-script.js").toFile()
            every { registerScript(scriptFile.toURI().toURL()) } throws IllegalArgumentException("invalid")

            // when
            scriptFile.writeText("function execute() {}")
            awaitRegistration(1)

            // then — asserted on the registration line alone; the watcher's own log line is about the
            // configured scripts directory, where the path is the message
            val registrationFailureLog = capturedOutput.toString().lines().single { it.contains("Failed to register") }
            registrationFailureLog shouldInclude "my-script.js"
            registrationFailureLog shouldNotInclude scriptsDir.toString()
        }
    }

    @Nested
    @DisplayName("Startup Behavior")
    inner class StartupBehavior {

        @Test
        fun `should not auto-load scripts already present when watcher starts`() {
            // given
            val existingScript = scriptsDir.resolve("existing.js").toFile()
            existingScript.writeText("function execute() {}")
            scriptLoader.start()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()

            // when — sentinel written after start confirms watcher is active
            sentinelFile.writeText("function execute() {}")
            awaitRegistration(1)

            // then — only sentinel registered, pre-existing script skipped
            verify(exactly = 0) { registerScript(existingScript.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }
    }

    @Nested
    @DisplayName("Enable Toggles")
    inner class EnableToggles {

        @Test
        fun `should not register existing scripts at startup when startup registration is disabled`() {
            // given — a script exists in the configured location, but startup registration is turned off
            scriptsDir.resolve("existing.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader(registerExistingScriptsAtStartup = false)

            // when
            loader.start()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()
            sentinelFile.writeText("function execute() {}")

            // then — startup scan skipped; the watcher still registers newly created files
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should do nothing when both startup registration and watching are disabled`() {
            // given — a script exists in the configured location but the loader is fully inert
            scriptsDir.resolve("existing.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader(registerExistingScriptsAtStartup = false, watchForNewScripts = false)

            // when
            loader.start()
            scriptsDir.resolve("added-later.js").toFile().writeText("function execute() {}")

            // then — nothing registered, no watcher
            verify(exactly = 0) { registerScript(any()) }
            loader.isRunning shouldBe false
            loader.stop()
        }

        @Test
        fun `should register existing scripts but not start the watcher when watching is disabled`() {
            // given — a script exists in the configured location and watching is turned off
            val existingScript = scriptsDir.resolve("existing.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader(watchForNewScripts = false)

            // when
            loader.start()
            scriptsDir.resolve("added-later.js").toFile().writeText("function execute() {}")

            // then — startup scan registered the existing script, the watcher never started, so the new file is ignored
            verify(exactly = 1) { registerScript(existingScript.toURI().toURL()) }
            loader.isRunning shouldBe false
            loader.stop()
        }
    }

    @Nested
    @DisplayName("Startup Resource Scan")
    inner class StartupResourceScan {

        @Test
        fun `should register scripts in the configured location at startup`() {
            // given
            val scriptFile = scriptsDir.resolve("my-script.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader()

            // when
            loader.start()

            // then
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should register scripts nested below the configured location at startup`() {
            // given
            val nestedScript = Files
                .createDirectories(scriptsDir.resolve("level1").resolve("level2"))
                .resolve("nested.js")
                .toFile()
                .also { it.writeText("function execute() {}") }
            val loader = createLoader()

            // when
            loader.start()

            // then
            verify(exactly = 1) { registerScript(nestedScript.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should skip chunk-prefixed and test suffixed files during startup scan`() {
            // given
            val chunkFile = scriptsDir.resolve("${CHUNK_PREFIX}abc123.js").toFile().also { it.writeText("export const x = 1") }
            val testFile = scriptsDir.resolve("my-script.test.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader()

            // when
            loader.start()

            // then
            verify(exactly = 0) { registerScript(chunkFile.toURI().toURL()) }
            verify(exactly = 0) { registerScript(testFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should log warning and continue when one matched file fails to register`(capturedOutput: CapturedOutput) {
            // given
            val failingFile = scriptsDir.resolve("failing.js").toFile().also { it.writeText("function execute() {}") }
            val okFile = scriptsDir.resolve("ok.js").toFile().also { it.writeText("function execute() {}") }
            every { registerScript(failingFile.toURI().toURL()) } throws IllegalArgumentException("invalid")
            val loader = createLoader()

            // when
            loader.start()

            // then — failing file's error is isolated, other file still registers, failure logged as a warning
            verify(exactly = 1) { registerScript(failingFile.toURI().toURL()) }
            verify(exactly = 1) { registerScript(okFile.toURI().toURL()) }
            capturedOutput.toString() shouldInclude "Failed to register"
            loader.stop()
        }

        @Test
        fun `should throw IllegalStateException when script resource resolution fails`() {
            // given — a classpath location that cannot resolve to a URL, forcing the resource scan to throw IOException
            val loader = createLoader(listOf(UNRESOLVABLE_CLASSPATH_LOCATION))

            // when / then
            shouldThrow<IllegalStateException> { loader.start() }
        }

        @Test
        fun `should register scripts from every configured location`(@TempDir secondScriptsDir: Path) {
            // given
            val firstScript = scriptsDir.resolve("first.js").toFile().also { it.writeText("function execute() {}") }
            val secondScript = secondScriptsDir.resolve("second.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader(listOf(fileLocationOf(scriptsDir), fileLocationOf(secondScriptsDir)))

            // when
            loader.start()

            // then
            verify(exactly = 1) { registerScript(firstScript.toURI().toURL()) }
            verify(exactly = 1) { registerScript(secondScript.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should not register a startup-registered file again when its ENTRY_CREATE event arrives late`() {
            // given
            val scriptFile = scriptsDir.resolve("my-script.js").toFile().also { it.writeText("function execute() {}") }
            val loader = createLoader()
            loader.start()
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }

            // when — a late ENTRY_CREATE for the already startup-registered file arrives via delete+recreate
            scriptFile.delete()
            scriptFile.writeText("function execute() {}")
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()
            sentinelFile.writeText("function execute() {}")

            // then — sentinel confirms the event was processed; the startup-registered file was not registered again
            await()
                .atMost(Duration.ofMillis(AUTOLOAD_TIMEOUT_MS))
                .pollInterval(Duration.ofMillis(AUTOLOAD_POLL_INTERVAL_MS))
                .untilAsserted {
                    verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
                }
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should retry a startup-scan file that failed to register on its next ENTRY_CREATE event, same as a watch-triggered file`(
            capturedOutput: CapturedOutput,
        ) {
            // given — file present at startup fails to register once, then succeeds on retry via a watch-triggered event
            val scriptFile = scriptsDir.resolve("startup-fail.js").toFile().also { it.writeText("function execute() {}") }
            every { registerScript(scriptFile.toURI().toURL()) } throws IllegalArgumentException("invalid") andThen Unit
            val loader = createLoader()

            // when — startup scan registers and fails once
            loader.start()
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }

            // when — retry via delete+recreate, the same mechanism a watch-triggered file uses
            scriptFile.delete()
            scriptFile.writeText("function execute() {}")

            // then — retry succeeds, proving the startup-scan failure left the path retryable exactly like a watch-triggered file
            await()
                .atMost(Duration.ofMillis(AUTOLOAD_TIMEOUT_MS))
                .pollInterval(Duration.ofMillis(AUTOLOAD_POLL_INTERVAL_MS))
                .untilAsserted {
                    verify(exactly = 2) { registerScript(scriptFile.toURI().toURL()) }
                }
            capturedOutput.toString() shouldInclude "Failed to register"
            loader.stop()
        }
    }

    @Nested
    @DisplayName("Multiple Locations")
    inner class MultipleLocations {

        @Test
        fun `should register a script added at runtime to any configured location`(@TempDir secondScriptsDir: Path) {
            // given
            val loader = createLoader(
                scriptLocations = listOf(fileLocationOf(scriptsDir), fileLocationOf(secondScriptsDir)),
                registerExistingScriptsAtStartup = false,
            )
            loader.start()

            // when
            val firstScript = scriptsDir.resolve("first.js").toFile().also { it.writeText("function execute() {}") }
            val secondScript = secondScriptsDir.resolve("second.js").toFile().also { it.writeText("function execute() {}") }

            // then
            awaitRegistration(2)
            verify(exactly = 1) { registerScript(firstScript.toURI().toURL()) }
            verify(exactly = 1) { registerScript(secondScript.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should keep watching a location nested in another configured location`() {
            // given — the nested location is collapsed into the outer one, which must not lose coverage of it
            val nestedLocation = Files.createDirectory(scriptsDir.resolve("nested"))
            val loader = createLoader(
                scriptLocations = listOf(fileLocationOf(scriptsDir), fileLocationOf(nestedLocation)),
                registerExistingScriptsAtStartup = false,
            )
            loader.start()

            // when
            val nestedScript = nestedLocation.resolve("nested.js").toFile().also { it.writeText("function execute() {}") }

            // then — registered exactly once, not once per configured location
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(nestedScript.toURI().toURL()) }
            loader.stop()
        }
    }

    @Nested
    @DisplayName("Locations Appearing After Startup")
    inner class LocationsAppearingAfterStartup {

        private fun createLoaderForLocationCreatedLater(pendingLocation: Path, vararg existingLocations: Path): ScriptLoader = createLoader(
            scriptLocations = (listOf(pendingLocation) + existingLocations).map(::fileLocationOf),
            registerExistingScriptsAtStartup = false,
        )

        @Test
        fun `should start the watcher and keep the only configured location pending when it does not exist`(capturedOutput: CapturedOutput) {
            // given — the resolver already warned about the missing location, so the loader must not report it a second time
            val loader = createLoaderForLocationCreatedLater(scriptsDir.resolve("does-not-exist"))

            // when
            loader.start()

            // then — the watcher runs so that the location can still be picked up once it appears
            loader.isRunning shouldBe true
            capturedOutput.toString() shouldNotInclude "ERROR"
            loader.stop()
        }

        @Test
        fun `should register scripts in a configured location that is created after startup`() {
            // given
            val pendingLocation = scriptsDir.resolve("created-later")
            val loader = createLoaderForLocationCreatedLater(pendingLocation)
            loader.start()

            // when
            Files.createDirectory(pendingLocation)
            val scriptFile = pendingLocation.resolve("my-script.js").toFile().also { it.writeText("function execute() {}") }

            // then
            awaitRegistration(1, PENDING_LOCATION_TIMEOUT_MS)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should register scripts already present in a configured location that appears fully populated after startup`() {
            // given — build the tree elsewhere and move it in, as a completed build or a deployment does
            val pendingLocation = scriptsDir.resolve("moved-in")
            val loader = createLoaderForLocationCreatedLater(pendingLocation)
            loader.start()
            val prebuiltDirectory = Files.createTempDirectory(scriptsDir.parent, "prebuilt-")
            prebuiltDirectory.resolve("my-script.js").toFile().writeText("function execute() {}")

            // when
            Files.move(prebuiltDirectory, pendingLocation)

            // then
            awaitRegistration(1, PENDING_LOCATION_TIMEOUT_MS)
            verify(exactly = 1) { registerScript(pendingLocation.resolve("my-script.js").toUri().toURL()) }
            loader.stop()
        }

        @Test
        fun `should register scripts in a configured location created as a nested path after startup`() {
            // given
            val pendingLocation = scriptsDir.resolve("level1").resolve("level2")
            val loader = createLoaderForLocationCreatedLater(pendingLocation)
            loader.start()

            // when — the whole path appears at once, so no parent watcher ever sees the location being created
            Files.createDirectories(pendingLocation)
            val scriptFile = pendingLocation.resolve("my-script.js").toFile().also { it.writeText("function execute() {}") }

            // then
            awaitRegistration(1, PENDING_LOCATION_TIMEOUT_MS)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should resume watching a configured location that is deleted and recreated`() {
            // given — a configured root has no parent watcher, so it can only come back through the pending set
            val loader = createLoader(registerExistingScriptsAtStartup = false)
            loader.start()

            // when
            Files.delete(scriptsDir)
            Files.createDirectory(scriptsDir)
            val scriptFile = scriptsDir.resolve("my-script.js").toFile().also { it.writeText("function execute() {}") }

            // then
            awaitRegistration(1, PENDING_LOCATION_TIMEOUT_MS)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            loader.stop()
        }

        @Test
        fun `should keep watching the existing locations while another configured location is still missing`(@TempDir existingLocation: Path) {
            // given
            val loader = createLoaderForLocationCreatedLater(scriptsDir.resolve("never-created"), existingLocation)
            loader.start()

            // when
            val scriptFile = existingLocation.resolve("my-script.js").toFile().also { it.writeText("function execute() {}") }

            // then
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
            loader.stop()
        }
    }

    @Nested
    @DisplayName("Subdirectory Support")
    inner class SubdirectorySupport {

        @Test
        fun `should not auto-load script already present in subdirectory when watcher starts`() {
            // given
            val subDir = Files.createDirectory(scriptsDir.resolve("sub"))
            val existingScript = subDir.resolve("existing.js").toFile()
            existingScript.writeText("function execute() {}")
            scriptLoader.start()
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()

            // when — sentinel written after start confirms watcher is active
            sentinelFile.writeText("function execute() {}")
            awaitRegistration(1)

            // then — only sentinel registered, pre-existing nested script skipped
            verify(exactly = 0) { registerScript(existingScript.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }

        @Test
        fun `should register script added to a subdirectory that already existed at startup`() {
            // given
            val subDir = Files.createDirectory(scriptsDir.resolve("sub"))
            scriptLoader.start()
            val scriptFile = subDir.resolve("my-script.js").toFile()

            // when
            scriptFile.writeText("function execute() {}")

            // then
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
        }

        @Test
        fun `should register script added to a subdirectory created after startup`() {
            // given
            scriptLoader.start()
            val subDir = Files.createDirectory(scriptsDir.resolve("new-sub"))
            val scriptFile = subDir.resolve("my-script.js").toFile()

            // when
            scriptFile.writeText("function execute() {}")

            // then
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
        }

        @Test
        fun `should register scripts already present in a subdirectory created after startup`() {
            // given — build the directory with content elsewhere, then move it in atomically,
            // simulating a directory that appears with pre-existing content (e.g. a moved folder)
            scriptLoader.start()
            val sourceDir = Files.createTempDirectory(scriptsDir.parent, "prebuilt-")
            sourceDir.resolve("nested.js").toFile().writeText("function execute() {}")
            val targetDir = scriptsDir.resolve("moved-dir")

            // when
            Files.move(sourceDir, targetDir)

            // then
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(targetDir.resolve("nested.js").toUri().toURL()) }
        }

        @Test
        fun `should register script in a nested multi-level subdirectory created after startup`() {
            // given
            scriptLoader.start()
            val nestedDir = Files.createDirectories(scriptsDir.resolve("level1").resolve("level2"))
            val scriptFile = nestedDir.resolve("my-script.js").toFile()

            // when
            scriptFile.writeText("function execute() {}")

            // then
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(scriptFile.toURI().toURL()) }
        }

        @Test
        fun `should not register chunk-prefixed or non-js file in a subdirectory`() {
            // given
            scriptLoader.start()
            val subDir = Files.createDirectory(scriptsDir.resolve("sub"))
            val chunkFile = subDir.resolve("${CHUNK_PREFIX}abc123.js").toFile()
            val tsFile = subDir.resolve("my-script.ts").toFile()
            val sentinelFile = subDir.resolve("sentinel.js").toFile()

            // when — write filtered files first, then sentinel to confirm their events were processed
            chunkFile.writeText("export const x = 1")
            tsFile.writeText("export function execute() {}")
            sentinelFile.writeText("function execute() {}")

            // then — sentinel registered, chunk and non-js files skipped
            awaitRegistration(1)
            verify(exactly = 0) { registerScript(chunkFile.toURI().toURL()) }
            verify(exactly = 0) { registerScript(tsFile.toURI().toURL()) }
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
        }

        @Test
        fun `should keep watching other directories when a watched subdirectory is deleted`() {
            // given
            val subDir = Files.createDirectory(scriptsDir.resolve("sub"))
            scriptLoader.start()

            // when — deleting a watched subdirectory invalidates only its own watch key
            Files.delete(subDir)
            val sentinelFile = scriptsDir.resolve("sentinel.js").toFile()
            sentinelFile.writeText("function execute() {}")

            // then — the watcher keeps running and still picks up new files at the root
            awaitRegistration(1)
            verify(exactly = 1) { registerScript(sentinelFile.toURI().toURL()) }
            scriptLoader.isRunning shouldBe true
        }
    }

    @Nested
    @DisplayName("Watcher Start Without A Watchable Location")
    inner class WatcherStartWithoutAWatchableLocation {

        @Test
        fun `should log why watching did not start when no configured location resolves to a directory on disk`(capturedOutput: CapturedOutput) {
            // given — the only location resolves to nothing, so there is neither a directory to watch nor one to wait for
            val loader = createLoader(
                scriptLocations = listOf(UNRESOLVABLE_CLASSPATH_LOCATION),
                registerExistingScriptsAtStartup = false,
            )

            // when
            loader.start()

            // then — the watcher cannot run, and the loader says so where it gives up instead of returning silently
            loader.isRunning shouldBe false
            capturedOutput.toString() shouldInclude "Script directory watching did not start"
        }
    }

    @Nested
    @DisplayName("Lifecycle")
    inner class Lifecycle {

        @Test
        fun `should stop gracefully when WatchService is null during directory registration`() {
            // given
            scriptLoader.start()
            val watchServiceField = ScriptLoader::class.java.getDeclaredField("watchService")
            watchServiceField.isAccessible = true
            watchServiceField.set(scriptLoader, null)

            // when — creating a directory triggers registerDirectoryWatch, which finds watchService null
            Files.createDirectory(scriptsDir.resolve("new-sub"))

            // then
            await()
                .atMost(Duration.ofMillis(AUTOLOAD_TIMEOUT_MS))
                .pollInterval(Duration.ofMillis(AUTOLOAD_POLL_INTERVAL_MS))
                .untilAsserted {
                    scriptLoader.isRunning shouldBe false
                }
        }

        @Test
        fun `should report isRunning as true after starting`() {
            scriptLoader.start()
            scriptLoader.isRunning shouldBe true
        }

        @Test
        fun `should stop cleanly after starting`() {
            // given
            scriptLoader.start()

            // when
            scriptLoader.stop()

            // then
            scriptLoader.isRunning shouldBe false
        }
    }
}
