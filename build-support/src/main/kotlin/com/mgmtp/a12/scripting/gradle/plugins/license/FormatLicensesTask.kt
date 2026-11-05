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

package com.mgmtp.a12.scripting.gradle.plugins.license

import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.provider.SetProperty
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject

/**
 * Gradle task that inserts or replaces the copyright header in all configured source files.
 *
 * Files that already have the correct header are left untouched. Files with an outdated
 * or missing header are updated in-place.
 */
abstract class FormatLicensesTask @Inject constructor(private val objects: ObjectFactory) : DefaultTask() {

    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val headerFile: RegularFileProperty

    @get:Input
    abstract val rules: ListProperty<LicenseHeaderRule>

    @get:Input
    abstract val folder: Property<String>

    @get:Input
    abstract val excludes: SetProperty<String>

    /**
     * The project directory that [folder] is resolved relative to. Captured as a
     * [DirectoryProperty] (rather than accessing `project` at execution time) to stay
     * configuration-cache compatible.
     */
    @get:Internal
    abstract val projectDirectory: DirectoryProperty

    @TaskAction
    fun formatLicenses() {
        val headerLines = headerFile.get().asFile.readLines()
        var updatedCount = 0
        val rootDir = projectDirectory.get().asFile

        val resolved = LicenseFileResolver.resolve(
            objects,
            rootDir.resolve(folder.get()),
            rules.get(),
            excludes.get()
        )

        for ((file, style) in resolved) {
            val original = file.readText()
            if (LicenseHeaderText.hasHeader(original, headerLines, style)) {
                continue
            }
            val relativePath = file.relativeTo(rootDir).path
            if (LicenseHeaderText.startsWithCommentWithoutCopyrightMarker(original, style)) {
                logger.warn(
                    "License header prepended above an existing leading comment in $relativePath. " +
                        "The comment carries no copyright marker, so it was kept — check the result " +
                        "if it was meant to be an outdated header."
                )
            }
            val updated = LicenseHeaderText.applyHeader(original, headerLines, style)
            file.writeText(updated)
            updatedCount++
            logger.lifecycle("License header applied: $relativePath")
        }

        if (updatedCount == 0) {
            logger.lifecycle("License format: all configured files already have a valid copyright header.")
        } else {
            logger.lifecycle("License format: updated $updatedCount file(s) with copyright header.")
        }
    }
}
