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

import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties.Companion.SCRIPT_LOCATIONS_PROPERTY
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import org.springframework.core.io.Resource
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import org.springframework.core.io.support.ResourcePatternResolver
import java.nio.file.Path

/**
 * Turns the configured script locations into the two things every consumer needs: the resources to register at
 * startup, and the directories on disk that are both watched for new scripts and used as import sandbox roots.
 *
 * Deriving both from the same locations is what keeps registration, watching and imports from drifting apart.
 */
class ScriptLocationResolver(
    scriptLocations: List<String>,
    private val resourcePatternResolver: ResourcePatternResolver = PathMatchingResourcePatternResolver(),
) {

    private companion object {
        const val ALL_FILES_BELOW_LOCATION_PATTERN = "**/*"

        // Path.startsWith compares whole name elements, so '/app/scripts-legacy' is not nested in '/app/scripts'.
        fun isNestedInAnotherRoot(rootDirectory: Path, allRootDirectories: List<Path>): Boolean = allRootDirectories.any { otherRootDirectory ->
            otherRootDirectory != rootDirectory && rootDirectory.startsWith(otherRootDirectory)
        }
    }

    private val normalizedScriptLocations: List<String> = scriptLocations.map { it.trimEnd('/') }

    /**
     * Resolved once, eagerly, so that a location that cannot contribute a root is reported exactly once per
     * application start rather than on every access.
     */
    val fileSystemRootDirectories: List<Path> = resolveFileSystemRootDirectoriesAndWarnAboutTheRest()

    /**
     * Every file below every configured location. Which of them is a script stays the registration filter's decision,
     * so the scan deliberately matches all files and returns directories as well.
     */
    fun resolveResources(): List<Resource> = normalizedScriptLocations.flatMap { scriptLocation ->
        resourcePatternResolver.getResources("$scriptLocation/$ALL_FILES_BELOW_LOCATION_PATTERN").toList()
    }

    private fun resolveFileSystemRootDirectoriesAndWarnAboutTheRest(): List<Path> {
        val rootDirectories = normalizedScriptLocations.flatMap(::resolveFileSystemRootDirectoriesOf).distinct()
        return rootDirectories.filterNot { rootDirectory -> isNestedInAnotherRoot(rootDirectory, rootDirectories) }
    }

    private fun resolveFileSystemRootDirectoriesOf(scriptLocation: String): List<Path> {
        val resolvedLocations = resourcePatternResolver.getResources("$scriptLocation/")
        if (resolvedLocations.isEmpty()) {
            warnLocationResolvesToNothing(scriptLocation)
            return emptyList()
        }
        return resolvedLocations.mapNotNull { resolvedLocation -> fileSystemRootDirectoryOf(resolvedLocation, scriptLocation) }
    }

    private fun fileSystemRootDirectoryOf(resolvedLocation: Resource, scriptLocation: String): Path? {
        if (!resolvedLocation.isFile) {
            warnLocationHasNoDirectoryOnDisk(resolvedLocation, scriptLocation)
            return null
        }
        // A file-backed resource reports isFile even when nothing exists at its path yet, which is what makes a
        // location that is created later a sandbox root from the start.
        if (!resolvedLocation.exists()) warnLocationDoesNotExistYet(scriptLocation)
        val rootDirectory = resolvedLocation.file
            .toPath()
            .toAbsolutePath()
            .normalize()
        // Defence in depth: whatever a location is spelled as, it must never hand out the file system root as a
        // sandbox. ScriptingProperties rejects every spelling that reaches one, so this is unreachable by design.
        if (rootDirectory.nameCount == 0) {
            logger().error(
                "{} entry '{}' resolves to the file system root '{}' and is ignored; name the directory the scripts lie in",
                SCRIPT_LOCATIONS_PROPERTY,
                scriptLocation,
                rootDirectory,
            )
            return null
        }
        return rootDirectory
    }

    private fun warnLocationHasNoDirectoryOnDisk(resolvedLocation: Resource, scriptLocation: String) {
        // An unresolvable classpath location has no URL at all, which is what tells it apart from a packaged one.
        val packagedResourceUrl = runCatching { resolvedLocation.url }.getOrNull()
        if (packagedResourceUrl == null) {
            warnLocationResolvesToNothing(scriptLocation)
            return
        }
        logger().warn(
            "{} entry '{}' is not watchable — packaged resource, no directory to watch: {}",
            SCRIPT_LOCATIONS_PROPERTY,
            scriptLocation,
            packagedResourceUrl,
        )
    }

    private fun warnLocationResolvesToNothing(scriptLocation: String) {
        logger().warn("{} entry '{}' resolves to nothing; no scripts are registered from it", SCRIPT_LOCATIONS_PROPERTY, scriptLocation)
    }

    private fun warnLocationDoesNotExistYet(scriptLocation: String) {
        logger().warn(
            "{} entry '{}' does not exist yet; no scripts are registered from it until it is created",
            SCRIPT_LOCATIONS_PROPERTY,
            scriptLocation,
        )
    }
}
