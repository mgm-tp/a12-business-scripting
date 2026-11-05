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

package com.mgmtp.a12.scripting.gradle.plugins.conventions.npm

import com.mgmtp.a12.scripting.gradle.plugins.conventions.CiEnvironment
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Exec
import org.gradle.api.tasks.TaskProvider

/**
 * Wires the common npm build lifecycle (install, compile, lint, format, test) into a Gradle module
 * and connects it to the `assemble`, `check` and `clean` lifecycle tasks provided by the `base`
 * plugin.
 *
 * Behaviour is tuned per module through [NpmConventionsExtension].
 */
class NpmConventionsPlugin : Plugin<Project> {

    companion object {
        const val PLUGIN_ID = "com.mgmtp.a12.scripting.conventions.npm"

        internal const val EXTENSION_NAME = "npmConventions"

        private const val FORMATTING_GROUP = "formatting"

        private const val TEST_OUTPUT_MARKER_FILE = "npmTest/output.marker"
    }

    override fun apply(project: Project) {
        val extension = project.extensions.create(EXTENSION_NAME, NpmConventionsExtension::class.java)
        project.pluginManager.apply("base")

        val npmCommand = NpmCommandResolver.resolve(project.providers)
        // Decides between 'npm ci' and 'npm install', and between a reporting and a fixing lint run.
        val isCi = CiEnvironment.isRunningOnCi(project.providers)

        // Tasks are registered after evaluation because their inputs, dependencies and existence
        // depend on the extension configuration set in the consuming module's build script.
        project.afterEvaluate {
            registerNpmTasks(project, extension, npmCommand, isCi)
        }
    }

    private fun registerNpmTasks(project: Project, extension: NpmConventionsExtension, npmCommand: String, isCi: Boolean) {
        val npmInstall = registerNpmInstall(project, extension, npmCommand, isCi)
        val npmCompile = registerNpmCompile(project, extension, npmCommand, npmInstall)
        val npmLint = registerNpmLint(project, extension, npmCommand, npmInstall, isCi)
        registerNpmFormat(project, npmCommand, npmInstall)
        val npmTest = if (extension.runTests.get()) registerNpmTest(project, extension, npmCommand, npmInstall) else null

        // npmLint may rewrite sources locally (eslint --fix), so tasks reading src run after it.
        npmCompile.configure { it.mustRunAfter(npmLint) }
        npmTest?.configure { it.mustRunAfter(npmLint) }

        project.tasks.named(NpmTaskNames.ASSEMBLE_LIFECYCLE) { it.dependsOn(npmCompile) }
        // npmFormat is deliberately wired into no lifecycle task: 'check' must not rewrite sources on CI.
        project.tasks.named(NpmTaskNames.CHECK_LIFECYCLE) {
            it.dependsOn(npmLint)
            if (npmTest != null) it.dependsOn(npmTest)
        }
        project.tasks.named(NpmTaskNames.CLEAN_LIFECYCLE, Delete::class.java) {
            it.delete(npmCompile.map { task -> task.outputs.files })
        }
    }

    private fun registerNpmInstall(project: Project, extension: NpmConventionsExtension, npmCommand: String, isCi: Boolean): TaskProvider<Exec> =
        project.tasks.register(NpmTaskNames.INSTALL, Exec::class.java) { task ->
            task.dependsOn(extension.installDependsOnTasks.get())
            task.workingDir = project.projectDir
            // 'npm ci' needs a lock file, which not every checkout of this module has, so the
            // reproducible install is used exactly where it is available rather than wherever the
            // build is on CI.
            task.commandLine(npmCommand, if (isCi && hasPackageLockJson(project)) "ci" else "install")
            task.inputs.file(project.file(NpmFileNames.PACKAGE_JSON))
            task.outputs.file(project.file(NpmFileNames.NODE_MODULES_LOCK))
            if (hasPackageLockJson(project)) {
                // Outside CI, npm may refresh the lock file, so it is an output instead of an input.
                if (isCi) {
                    task.inputs.file(project.file(NpmFileNames.PACKAGE_LOCK_JSON))
                } else {
                    task.outputs.file(project.file(NpmFileNames.PACKAGE_LOCK_JSON))
                }
            }
        }

    private fun registerNpmCompile(project: Project, extension: NpmConventionsExtension, npmCommand: String, npmInstall: TaskProvider<Exec>): TaskProvider<Exec> =
        project.tasks.register(NpmTaskNames.COMPILE, Exec::class.java) { task ->
            task.dependsOn(npmInstall)
            task.workingDir = project.projectDir
            task.commandLine(npmCommand, "run", "compile")
            addInputDirectories(project, task, extension.sourceDirectories.get())
            addInputFilesAndPackageLockJsonWhenPresent(project, task, extension.compileInputFiles.get())
            task.outputs.dir(project.file(extension.compileOutputDirectory.get()))
            extension.compileOutputFiles.get().forEach { fileName -> task.outputs.file(project.file(fileName)) }
        }

    private fun registerNpmLint(
        project: Project,
        extension: NpmConventionsExtension,
        npmCommand: String,
        npmInstall: TaskProvider<Exec>,
        isCi: Boolean,
    ): TaskProvider<Exec> =
        project.tasks.register(NpmTaskNames.LINT, Exec::class.java) { task ->
            task.dependsOn(npmInstall)
            configureNpmLint(task, project, extension, npmCommand, isCi)
        }

    internal fun configureNpmLint(task: Exec, project: Project, extension: NpmConventionsExtension, npmCommand: String, isCi: Boolean) {
        task.workingDir = project.projectDir
        if (isCi) {
            // On CI, lint must fail on fixable violations instead of silently fixing the workspace.
            task.commandLine(npmCommand, "run", "lint")
        } else {
            task.commandLine(npmCommand, "run", "format")
            // eslint --fix rewrites the sources, so every source directory is also an output of this
            // task; declaring them makes the task up-to-date on the next run once they are fixed.
            extension.sourceDirectories.get().forEach { sourceDirectory ->
                task.outputs.dir(project.file(sourceDirectory))
            }
        }
        addInputDirectories(project, task, extension.sourceDirectories.get())
        addInputFilesAndPackageLockJsonWhenPresent(project, task, extension.lintInputFiles.get())
    }

    // Declares no inputs or outputs, so it always runs: contributors invoke it to have their sources
    // rewritten, which an up-to-date check would skip.
    private fun registerNpmFormat(project: Project, npmCommand: String, npmInstall: TaskProvider<Exec>): TaskProvider<Exec> =
        project.tasks.register(NpmTaskNames.FORMAT, Exec::class.java) { task ->
            task.group = FORMATTING_GROUP
            task.description = "Formats the sources of this npm module and fixes auto-fixable lint violations."
            task.dependsOn(npmInstall)
            task.workingDir = project.projectDir
            task.commandLine(npmCommand, "run", "format")
        }

    private fun registerNpmTest(project: Project, extension: NpmConventionsExtension, npmCommand: String, npmInstall: TaskProvider<Exec>): TaskProvider<Exec> =
        project.tasks.register(NpmTaskNames.TEST, Exec::class.java) { task ->
            task.dependsOn(npmInstall)
            task.workingDir = project.projectDir
            task.commandLine(npmCommand, "run", "test")
            // Tests exercise the production sources too, so every source directory is an input.
            addInputDirectories(project, task, extension.sourceDirectories.get())
            addInputFilesAndPackageLockJsonWhenPresent(project, task, extension.testInputFiles.get())
            // The manifest holds the test script itself, so editing it has to rerun the tests.
            task.inputs.file(project.file(NpmFileNames.PACKAGE_JSON))
            // Declaring the marker as an output (touched only after a successful run) is what lets
            // Gradle skip npmTest as UP-TO-DATE on a later build with unchanged inputs.
            val testOutputMarker = project.layout.buildDirectory.file(TEST_OUTPUT_MARKER_FILE)
            task.outputs.file(testOutputMarker)
            task.doLast {
                testOutputMarker.get().asFile.apply {
                    parentFile.mkdirs()
                    writeText("passed")
                }
            }
        }

    private fun addInputFilesAndPackageLockJsonWhenPresent(project: Project, task: Exec, fileNames: List<String>) {
        fileNames.forEach { fileName -> task.inputs.file(project.file(fileName)) }
        // Tracked wherever it exists: a dependency change has to rebuild, while declaring the lock
        // file as an input would fail the task in a checkout that has none.
        if (hasPackageLockJson(project)) {
            task.inputs.file(project.file(NpmFileNames.PACKAGE_LOCK_JSON))
        }
    }

    private fun addInputDirectories(project: Project, task: Exec, directoryPaths: List<String>) {
        directoryPaths.forEach { directoryPath -> task.inputs.dir(project.file(directoryPath)) }
    }

    private fun hasPackageLockJson(project: Project): Boolean =
        project.file(NpmFileNames.PACKAGE_LOCK_JSON).isFile
}
