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

import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.Delete
import org.gradle.api.tasks.Exec
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test
import java.io.File
import io.kotest.matchers.string.shouldContain as shouldContainString

/**
 * The npm build lifecycle these conventions wire into a module.
 */
private class NpmConventionsPluginTest {

    companion object {
        private const val PLUGIN_ID = "com.mgmtp.a12.scripting.conventions.npm"

        // Literals on purpose, not NpmTaskNames: the public task names are a contract that module build
        // files (scripts/build.gradle.kts) and contributors reference by string, so a renamed constant
        // has to turn this test red rather than follow the rename.
        private const val TASK_INSTALL = "npmInstall"
        private const val TASK_COMPILE = "npmCompile"
        private const val TASK_LINT = "npmLint"
        private const val TASK_FORMAT = "npmFormat"
        private const val TASK_TEST = "npmTest"
        private const val TASK_SBOM = "npmSbom"
        private const val TASK_PACK = "npmPack"
        private const val TASK_SET_VERSION = "npmSetVersion"
        private const val TASK_PUBLISH = "npmPublish"
        private const val TASK_PUBLISH_LIFECYCLE = "publish"
        private const val TASK_ASSEMBLE = "assemble"
        private const val TASK_CHECK = "check"
        private const val TASK_CLEAN = "clean"
        private const val TASK_COPY_LEGAL_DOCUMENTS = "copyLegalDocuments"

        // Neither 'dist', which is the default, nor 'build', which the base plugin's clean deletes
        // regardless: only a directory the plugin has to wire in itself proves the wiring.
        private const val COMPILE_OUTPUT_DIRECTORY = "compiled-output"
        private const val TYPESCRIPT_BUILD_INFO_FILE = "tsconfig.tsbuildinfo"

        private val coreTasks = listOf(TASK_INSTALL, TASK_COMPILE, TASK_LINT)

        /** Publishing tasks these conventions must never register. */
        private val publishingTasks = listOf(
            TASK_SET_VERSION,
            TASK_SBOM,
            TASK_PACK,
            TASK_PUBLISH,
            TASK_PUBLISH_LIFECYCLE,
            TASK_COPY_LEGAL_DOCUMENTS,
        )

        private const val FIRST_SCRIPT_ROOT = "first-scripts/src"
        private const val SECOND_SCRIPT_ROOT = "second-scripts/src"
        private const val SCRIPT_IN_FIRST_ROOT = "$FIRST_SCRIPT_ROOT/first-script.ts"
        private const val SCRIPT_IN_SECOND_ROOT = "$SECOND_SCRIPT_ROOT/second-script.ts"
        private val bothScriptRoots = listOf(FIRST_SCRIPT_ROOT, SECOND_SCRIPT_ROOT)
    }

    private fun applyPluginUnderTest(
        prepareProjectDirectory: (File) -> Unit = {},
        applyPluginsBefore: (Project) -> Unit = {},
        configure: (NpmConventionsExtension) -> Unit = {},
    ): Project {
        val project = ProjectBuilder.builder().build()
        prepareProjectDirectory(project.projectDir)
        applyPluginsBefore(project)
        project.pluginManager.apply(PLUGIN_ID)
        configure(project.extensions.getByType(NpmConventionsExtension::class.java))
        (project as org.gradle.api.internal.project.ProjectInternal).evaluate()
        return project
    }

    private fun dependencyNamesOf(project: Project, taskName: String): Set<String> {
        val task = project.tasks.getByName(taskName)
        return task.taskDependencies.getDependencies(task).map(Task::getName).toSet()
    }

    @Test
    fun `should apply the base plugin`() {
        val project = applyPluginUnderTest()
        project.pluginManager.hasPlugin("base") shouldBe true
    }

    @Test
    fun `should register the core npm tasks`() {
        // when
        val project = applyPluginUnderTest()

        // then
        coreTasks.forEach { taskName -> project.tasks.findByName(taskName).shouldNotBeNull() }
    }

    // These conventions cover the build lifecycle only, so a module that applies them must end up
    // with none of the publishing surface.
    @Test
    fun `should register no publishing task`() {
        // when
        val project = applyPluginUnderTest()

        // then
        publishingTasks.forEach { taskName -> project.tasks.findByName(taskName) shouldBe null }
    }

    @Test
    fun `should register npmTest and wire it into check by default`() {
        // when
        val project = applyPluginUnderTest()

        // then
        project.tasks.findByName(TASK_TEST).shouldNotBeNull()
        dependencyNamesOf(project, TASK_CHECK) shouldContain TASK_TEST
    }

    @Test
    fun `should not register npmTest when tests are disabled`() {
        // when
        val project = applyPluginUnderTest(configure = { it.runTests.set(false) })

        // then
        project.tasks.findByName(TASK_TEST) shouldBe null
        dependencyNamesOf(project, TASK_CHECK) shouldContain TASK_LINT
    }

    @Test
    fun `should run the compile script after npmInstall and wire npmCompile into assemble`() {
        // when
        val project = applyPluginUnderTest()

        // then
        npmScriptArgumentsOf(project, TASK_COMPILE) shouldBe listOf("run", "compile")
        dependencyNamesOf(project, TASK_COMPILE) shouldContain TASK_INSTALL
        dependencyNamesOf(project, TASK_ASSEMBLE) shouldContain TASK_COMPILE
    }

    @Test
    fun `should run the format script from npmFormat and keep it out of check so CI never rewrites sources`() {
        // when
        val project = applyPluginUnderTest()

        // then
        npmScriptArgumentsOf(project, TASK_FORMAT) shouldBe listOf("run", "format")
        dependencyNamesOf(project, TASK_FORMAT) shouldContain TASK_INSTALL
        dependencyNamesOf(project, TASK_CHECK) shouldNotContain TASK_FORMAT
    }

    @Test
    fun `should delete the configured compile output directory on clean`() {
        // when
        val project = applyPluginUnderTest(configure = { it.compileOutputDirectory.set(COMPILE_OUTPUT_DIRECTORY) })

        // then
        deletedFilesOf(project) shouldContain project.file(COMPILE_OUTPUT_DIRECTORY)
    }

    // 'tsc --build' records its incremental state beside tsconfig.json, not in the output directory,
    // so a clean that deleted the directory alone would leave the next compile believing it is current.
    @Test
    fun `should delete the TypeScript build info file on clean by default`() {
        // when
        val project = applyPluginUnderTest()

        // then
        deletedFilesOf(project) shouldContain project.file(TYPESCRIPT_BUILD_INFO_FILE)
    }

    private fun deletedFilesOf(project: Project): Set<File> =
        (project.tasks.getByName(TASK_CLEAN) as Delete).targetFiles.files

    // The npm executable name differs per operating system, so assertions cover the arguments only.
    private fun npmScriptArgumentsOf(project: Project, taskName: String): List<String> =
        (project.tasks.getByName(taskName) as Exec).commandLine.drop(1)

    // In a checkout without a lock file, 'npm ci' would fail outright and declaring the lock file
    // as a task input would fail input validation instead.
    @Test
    fun `should install without a lock file and track none`() {
        // when
        val project = applyPluginUnderTest()

        // then
        npmScriptArgumentsOf(project, TASK_INSTALL) shouldBe listOf("install")
        val installInputFiles = project.tasks.getByName(TASK_INSTALL).inputs.files.files
        installInputFiles shouldNotContain project.file("package-lock.json")
        project.tasks.getByName(TASK_COMPILE).inputs.files.files shouldNotContain project.file("package-lock.json")
    }

    @Test
    fun `should track the lock file as a compile input when the module ships one`() {
        // when
        val project = applyPluginUnderTest(prepareProjectDirectory = { projectDirectory ->
            createFileIn(projectDirectory, "package-lock.json")
        })

        // then
        project.tasks.getByName(TASK_COMPILE).inputs.files.files shouldContain project.file("package-lock.json")
    }

    @Test
    fun `should track production and test sources as npmTest inputs`() {
        // given
        lateinit var productionSource: File
        lateinit var testSource: File

        // when
        val project = applyPluginUnderTest(prepareProjectDirectory = { projectDirectory ->
            productionSource = createFileIn(projectDirectory, "src/api/production.ts")
            testSource = createFileIn(projectDirectory, "src/test/production.test.ts")
        })

        // then
        val testInputFiles = project.tasks.getByName(TASK_TEST).inputs.files.files
        testInputFiles shouldContain productionSource
        testInputFiles shouldContain testSource
    }

    @Test
    fun `should track every configured source directory as an npmCompile input`() {
        // given
        lateinit var scriptInFirstRoot: File
        lateinit var scriptInSecondRoot: File

        // when
        val project = applyPluginUnderTest(
            prepareProjectDirectory = { projectDirectory ->
                scriptInFirstRoot = createFileIn(projectDirectory, SCRIPT_IN_FIRST_ROOT)
                scriptInSecondRoot = createFileIn(projectDirectory, SCRIPT_IN_SECOND_ROOT)
            },
            configure = { it.sourceDirectories.set(bothScriptRoots) },
        )

        // then — a root missing from the inputs would leave npmCompile up-to-date after its scripts change
        val compileInputFiles = project.tasks.getByName(TASK_COMPILE).inputs.files.files
        compileInputFiles shouldContain scriptInFirstRoot
        compileInputFiles shouldContain scriptInSecondRoot
    }

    @Test
    fun `should track every configured source directory as an npmTest input`() {
        // given
        lateinit var scriptInFirstRoot: File
        lateinit var scriptInSecondRoot: File

        // when
        val project = applyPluginUnderTest(
            prepareProjectDirectory = { projectDirectory ->
                scriptInFirstRoot = createFileIn(projectDirectory, SCRIPT_IN_FIRST_ROOT)
                scriptInSecondRoot = createFileIn(projectDirectory, SCRIPT_IN_SECOND_ROOT)
            },
            configure = { it.sourceDirectories.set(bothScriptRoots) },
        )

        // then
        val testInputFiles = project.tasks.getByName(TASK_TEST).inputs.files.files
        testInputFiles shouldContain scriptInFirstRoot
        testInputFiles shouldContain scriptInSecondRoot
    }

    @Test
    fun `should track every configured source directory as an input and output of the local npmLint`() {
        // given
        lateinit var scriptInFirstRoot: File
        lateinit var scriptInSecondRoot: File

        // when
        val lintTask = configureLintProbeTask(
            isCi = false,
            prepareProjectDirectory = { projectDirectory ->
                scriptInFirstRoot = createFileIn(projectDirectory, SCRIPT_IN_FIRST_ROOT)
                scriptInSecondRoot = createFileIn(projectDirectory, SCRIPT_IN_SECOND_ROOT)
            },
            configure = { it.sourceDirectories.set(bothScriptRoots) },
        )

        // then — eslint --fix rewrites each root, so each one is an output as well as an input
        val project = lintTask.project
        lintTask.inputs.files.files shouldContain scriptInFirstRoot
        lintTask.inputs.files.files shouldContain scriptInSecondRoot
        lintTask.outputs.files.files shouldContain project.file(FIRST_SCRIPT_ROOT)
        lintTask.outputs.files.files shouldContain project.file(SECOND_SCRIPT_ROOT)
    }

    @Test
    fun `should track package json as an npmTest input so an edited test script reruns the tests`() {
        // when
        val project = applyPluginUnderTest()

        // then
        project.tasks.getByName(TASK_TEST).inputs.files.files shouldContain project.file("package.json")
    }

    @Test
    fun `should declare a build-directory marker file as npmTest output so a successful run can be up to date`() {
        // when
        val project = applyPluginUnderTest()

        // then
        val outputFiles = project.tasks.getByName(TASK_TEST).outputs.files.files
        outputFiles shouldContain project.layout.buildDirectory.file("npmTest/output.marker").get().asFile
    }

    @Test
    fun `should run npmLint after npmInstall`() {
        // when
        val project = applyPluginUnderTest()

        // then
        dependencyNamesOf(project, TASK_LINT) shouldContain TASK_INSTALL
    }

    @Test
    fun `should auto-fix lint findings locally and track the rewritten sources as output`() {
        // when
        val lintTask = configureLintProbeTask(isCi = false)

        // then: the fixing variant is the 'format' script, so the eslint invocation is single-homed
        // in package.json instead of being spelled out again here
        lintTask.commandLine shouldBe listOf("npm", "run", "format")
        lintTask.outputs.files.files shouldContain lintTask.project.file("src")
    }

    @Test
    fun `should lint without fixing on CI so fixable violations fail the build`() {
        // when
        val lintTask = configureLintProbeTask(isCi = true)

        // then
        lintTask.commandLine shouldBe listOf("npm", "run", "lint")
        lintTask.outputs.files.files.shouldBeEmpty()
    }

    @Test
    fun `should order npmCompile and npmTest after npmLint because it may rewrite sources`() {
        // when
        val project = applyPluginUnderTest()

        // then
        mustRunAfterNamesOf(project, TASK_COMPILE) shouldContain TASK_LINT
        mustRunAfterNamesOf(project, TASK_TEST) shouldContain TASK_LINT
    }

    private fun configureLintProbeTask(
        isCi: Boolean,
        prepareProjectDirectory: (File) -> Unit = {},
        configure: (NpmConventionsExtension) -> Unit = {},
    ): Exec {
        val project = applyPluginUnderTest(prepareProjectDirectory = prepareProjectDirectory, configure = configure)
        val extension = project.extensions.getByType(NpmConventionsExtension::class.java)
        val probeTask = project.tasks.create("npmLintProbe", Exec::class.java)
        NpmConventionsPlugin().configureNpmLint(probeTask, project, extension, "npm", isCi)
        return probeTask
    }

    private fun mustRunAfterNamesOf(project: Project, taskName: String): Set<String> {
        val task = project.tasks.getByName(taskName)
        return task.mustRunAfter.getDependencies(task).map(Task::getName).toSet()
    }

    @Test
    fun `should use the configured compile output directory`() {
        // when
        val project = applyPluginUnderTest(configure = { it.compileOutputDirectory.set(COMPILE_OUTPUT_DIRECTORY) })

        // then
        val outputPaths = project.tasks.getByName(TASK_COMPILE).outputs.files.map { it.name }
        outputPaths shouldContain COMPILE_OUTPUT_DIRECTORY
    }

    private fun createFileIn(projectDirectory: File, relativePath: String): File =
        projectDirectory.resolve(relativePath).apply {
            parentFile.mkdirs()
            writeText("export {}")
        }
}
