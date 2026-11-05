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
import org.gradle.api.GradleException
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
 * Gradle task that checks whether all configured source files contain the expected
 * copyright header. Fails the build if any file is missing or has a different header.
 */
abstract class CheckLicensesTask @Inject constructor(private val objects: ObjectFactory) : DefaultTask() {

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
    fun checkLicenses() {
        val headerLines = headerFile.get().asFile.readLines()
        val missingHeaders = mutableListOf<String>()
        val rootDir = projectDirectory.get().asFile

        val resolved = LicenseFileResolver.resolve(
            objects,
            rootDir.resolve(folder.get()),
            rules.get(),
            excludes.get()
        )

        for ((file, style) in resolved) {
            val content = file.readText()
            if (!LicenseHeaderText.hasHeader(content, headerLines, style)) {
                missingHeaders.add(file.relativeTo(rootDir).path)
            }
        }

        if (missingHeaders.isNotEmpty()) {
            val list = missingHeaders.sorted().joinToString("\n  - ", prefix = "\n  - ")
            throw GradleException(
                "The following files are missing a valid copyright header.$list\n\n" +
                    "Run './gradlew formatLicenses' (or licenseFormat) to apply headers automatically."
            )
        }

        logger.lifecycle("License check passed. All configured files contain a valid copyright header.")
    }
}
