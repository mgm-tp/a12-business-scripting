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

import org.gradle.api.Plugin
import org.gradle.api.Project

/**
 * Gradle plugin that provides [CheckLicensesTask] and [FormatLicensesTask] for managing
 * copyright headers across source files.
 *
 * Plugin ID: `com.mgmtp.a12.scripting.license`
 *
 * The plugin registers:
 * - `checkLicenses` — verifies all configured files have the expected header
 * - `formatLicenses` — inserts/replaces headers in all configured files
 * - `licenseFormat` — alias for `formatLicenses` (backwards compatibility)
 *
 * Configuration is done via the `licenseHeaders` DSL extension on the project.
 */
class LicensePlugin : Plugin<Project> {

    override fun apply(project: Project) {
        val extension = project.extensions.create(
            "licenseHeaders",
            LicenseExtension::class.java
        )

        val checkTask = project.tasks.register("checkLicenses", CheckLicensesTask::class.java) { task ->
            task.group = "verification"
            task.description = "Checks all configured source files for a valid copyright header."
            task.headerFile.set(extension.headerFile)
            task.rules.set(extension.rules)
            task.folder.set(extension.folder)
            task.excludes.set(extension.excludes)
            task.projectDirectory.set(project.layout.projectDirectory)
        }

        val formatTask = project.tasks.register("formatLicenses", FormatLicensesTask::class.java) { task ->
            task.group = "formatting"
            task.description = "Inserts or replaces copyright headers in all configured source files."
            task.headerFile.set(extension.headerFile)
            task.rules.set(extension.rules)
            task.folder.set(extension.folder)
            task.excludes.set(extension.excludes)
            task.projectDirectory.set(project.layout.projectDirectory)
        }

        // Backwards-compatible alias
        project.tasks.register("licenseFormat") { task ->
            task.group = "formatting"
            task.description = "Alias for formatLicenses (backwards compatibility)."
            task.dependsOn(formatTask)
        }

        // Ensure the 'check' lifecycle task exists and wire checkLicenses into it
        project.plugins.apply("base")
        project.tasks.named("check").configure { it.dependsOn(checkTask) }
    }
}
