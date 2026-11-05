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
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import org.springframework.context.SmartLifecycle
import java.io.IOException
import java.io.UncheckedIOException
import java.net.URI
import java.net.URL
import java.nio.file.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class ScriptLoader(
    private val scriptLocationResolver: ScriptLocationResolver,
    private val chunkNamePrefixes: List<String>,
    private val scriptTypeDescription: String,
    private val registerExistingScriptsAtStartup: Boolean,
    private val watchForNewScripts: Boolean,
    private val register: (URL) -> Unit,
) : SmartLifecycle {

    private val registeredUris: MutableSet<URI> = ConcurrentHashMap.newKeySet()

    /** Configured roots that hold no watch key, re-checked on every watch tick so they recover once they exist. */
    private val unwatchedRoots: MutableSet<Path> = ConcurrentHashMap.newKeySet()
    private var watchService: WatchService? = null
    private var watchThread: Thread? = null

    companion object {
        private const val TEST_FILE_SUFFIX = ".test.js"
        private const val JS_SUFFIX = ".js"
        private const val WATCH_POLL_TIMEOUT_SECONDS = 1L
    }

    @Volatile private var running = false

    override fun start() {
        registeredUris.clear()
        if (registerExistingScriptsAtStartup) {
            registerExistingScripts()
        } else {
            logger().info("Startup registration of existing {} scripts is disabled.", scriptTypeDescription)
        }

        if (!watchForNewScripts) {
            logger().info("Script directory watching is disabled; new {} scripts will not be picked up at runtime.", scriptTypeDescription)
            return
        }

        val (watchableRootDirectories, missingRootDirectories) =
            scriptLocationResolver.fileSystemRootDirectories.partition(Files::isDirectory)
        unwatchedRoots.clear()
        unwatchedRoots.addAll(missingRootDirectories)
        if (watchableRootDirectories.isEmpty() && unwatchedRoots.isEmpty()) {
            logger().warn(
                "Script directory watching did not start: no configured script location resolves to a directory on disk; " +
                    "new {} scripts will not be picked up at runtime.",
                scriptTypeDescription,
            )
            return
        }

        try {
            watchService = FileSystems.getDefault().newWatchService()
            // Only seeds watch keys — existing files were already handled by registerExistingScripts() above.
            watchableRootDirectories.forEach { rootDirectory ->
                walkDirectoryTreeAndRegister(rootDirectory, "Failed to register watch key for directory") { }
            }
            running = true
            watchThread = Thread(::watchLoop, "script-loader-watcher").also {
                it.isDaemon = true
                it.start()
            }
            logger().info("Script directory watching started, watching: {}", watchableRootDirectories)
            if (unwatchedRoots.isNotEmpty()) {
                logger().info("Waiting for configured script locations that do not exist yet: {}", unwatchedRoots)
            }
        } catch (e: IOException) {
            watchService?.close()
            watchService = null
            running = false
            logger().error("Failed to start script watcher for '{}': {}", watchableRootDirectories, e.message)
        }
    }

    override fun stop() {
        running = false
        watchService?.close()
        watchThread?.join(5000)
        if (watchThread?.isAlive == true) {
            logger().warn("Watcher thread did not stop within 5 seconds.")
        }
        watchService = null
        watchThread = null
        logger().info("Script directory watching stopped.")
    }

    override fun isRunning() = running

    override fun getPhase() = SmartLifecycle.DEFAULT_PHASE

    private fun watchLoop() {
        val ws = watchService
        if (ws == null) {
            stopDueToMissingWatchService()
            return
        }
        while (isRunning) {
            retryUnwatchedRoots()
            val key = ws.poll(WATCH_POLL_TIMEOUT_SECONDS, TimeUnit.SECONDS) ?: continue
            val watchedDirectory = key.watchable() as Path
            for (event in key.pollEvents()) {
                @Suppress("UNCHECKED_CAST")
                when (event.kind()) {
                    StandardWatchEventKinds.ENTRY_CREATE -> {
                        val relativePath = (event as WatchEvent<Path>).context()
                        handleNewPath(watchedDirectory.resolve(relativePath))
                    }
                    StandardWatchEventKinds.OVERFLOW -> rescanDirectoryTrees()
                }
            }
            if (!key.reset()) handleInvalidatedWatchKey(watchedDirectory)
        }
    }

    // A configured root has no parent watcher that could re-register it, so it goes back into the pending set;
    // any other directory is re-registered by its parent's ENTRY_CREATE event.
    private fun handleInvalidatedWatchKey(watchedDirectory: Path) {
        if (watchedDirectory !in scriptLocationResolver.fileSystemRootDirectories) {
            logger().debug("Watch key for '{}' is no longer valid; that directory will no longer be watched.", watchedDirectory)
            return
        }
        unwatchedRoots.add(watchedDirectory)
        logger().debug("Configured script location '{}' is gone; watching resumes as soon as it exists again.", watchedDirectory)
    }

    private fun retryUnwatchedRoots() {
        unwatchedRoots.filter(Files::isDirectory).forEach { rootDirectory ->
            unwatchedRoots.remove(rootDirectory)
            walkDirectoryTreeAndRegister(rootDirectory, "Failed to register newly created script location") { tryRegisterScript(it) }
            logger().info("Configured script location '{}' now exists; its scripts are registered and it is watched.", rootDirectory)
        }
    }

    private fun handleNewPath(path: Path) {
        if (Files.isDirectory(path)) {
            walkDirectoryTreeAndRegister(path, "Failed to register newly created directory") { tryRegisterScript(it) }
        } else {
            tryRegisterScript(path)
        }
    }

    private fun isRegisterableScript(filename: String): Boolean = filename.endsWith(JS_SUFFIX) &&
        !filename.endsWith(TEST_FILE_SUFFIX) &&
        chunkNamePrefixes.none { filename.startsWith(it) }

    private fun tryRegisterScript(path: Path): Boolean = tryRegisterScript(path.toUri(), path.fileName.toString())

    private fun tryRegisterScript(uri: URI, filename: String): Boolean {
        if (!isRegisterableScript(filename)) {
            logger().debug("Skipping '{}'. Not a registerable script", filename)
            return false
        }
        if (!registeredUris.add(uri)) return false
        try {
            register(uri.toURL())
            logger().debug("Registered {} script: {}", scriptTypeDescription, filename)
            return true
        } catch (e: Exception) {
            registeredUris.remove(uri)
            logger().warn("Failed to register {} script '{}': {}", scriptTypeDescription, filename, e.message)
            return false
        }
    }

    private fun registerExistingScripts() {
        try {
            var registeredCount = 0
            for (resource in scriptLocationResolver.resolveResources()) {
                val filename = resource.filename ?: continue
                // Resource.file throws for resources inside a jar; fall back to the URL form. Normalizing
                // through Path keeps file URIs identical to watch-event URIs so registeredUris dedups both phases.
                val uri = runCatching { resource.file.toPath().toUri() }.getOrElse { resource.url.toURI() }
                if (tryRegisterScript(uri, filename)) registeredCount++
            }
            logger().info("Successfully registered {} {} script(s) at startup.", registeredCount, scriptTypeDescription)
        } catch (e: IOException) {
            throw IllegalStateException("Failed to resolve $scriptTypeDescription script resources", e)
        }
    }

    private fun registerDirectoryWatch(directory: Path) {
        val ws = watchService
        if (ws == null) {
            stopDueToMissingWatchService()
            return
        }
        try {
            directory.register(ws, StandardWatchEventKinds.ENTRY_CREATE, StandardWatchEventKinds.OVERFLOW)
            logger().debug("Registered directory for script watching: {}", directory)
        } catch (e: IOException) {
            logger().warn("Failed to watch directory '{}' for new scripts: {}", directory, e.message)
        } catch (_: ClosedWatchServiceException) {
            logger().warn("Failed to watch directory '{}': watch service is already closed.", directory)
        }
    }

    private fun walkDirectoryTreeAndRegister(root: Path, failureMessage: String, onFile: (Path) -> Unit) {
        try {
            Files.walk(root).use { stream ->
                stream.forEach { path ->
                    if (Files.isDirectory(path)) {
                        registerDirectoryWatch(path)
                    } else {
                        onFile(path)
                    }
                }
            }
        } catch (e: Exception) {
            when (e) {
                is IOException, is UncheckedIOException -> logger().warn("$failureMessage '{}': {}", root, e.message)
                else -> throw e
            }
        }
    }

    private fun stopDueToMissingWatchService() {
        logger().error("WatchService is unexpectedly null; script watcher thread is shutting down.")
        running = false
    }

    // Skipping roots that are not directories keeps a configured-but-absent location from warning on every overflow
    private fun rescanDirectoryTrees() {
        scriptLocationResolver.fileSystemRootDirectories
            .filter(Files::isDirectory)
            .forEach { rootDirectory -> walkDirectoryTreeAndRegister(rootDirectory, "Failed to rescan") { tryRegisterScript(it) } }
    }
}
