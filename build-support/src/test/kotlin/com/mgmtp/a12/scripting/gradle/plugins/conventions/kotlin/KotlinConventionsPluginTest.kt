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

package com.mgmtp.a12.scripting.gradle.plugins.conventions.kotlin

import com.mgmtp.a12.scripting.gradle.plugins.license.CommentStyle
import com.mgmtp.a12.scripting.gradle.plugins.license.LicenseExtension
import com.mgmtp.a12.scripting.gradle.plugins.license.LicenseHeaderRule
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.api.plugins.internal.DefaultJavaPluginExtension
import org.gradle.api.tasks.bundling.Jar
import org.gradle.api.tasks.testing.junitplatform.JUnitPlatformOptions
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.gradle.api.tasks.testing.Test as TestTask

/**
 * The Kotlin, lint and legal-document conventions every module gets.
 */
private class KotlinConventionsPluginTest {

    private val expectedPlugins = listOf(
        "org.jetbrains.kotlin.jvm",
        "java-library",
        "org.jmailen.kotlinter",
        "com.mgmtp.a12.scripting.license",
    )

    private val jarTaskNames = listOf("jar", "sourcesJar", "javadocJar")

    companion object {
        private const val PLUGIN_ID = "com.mgmtp.a12.scripting.conventions.kotlin"
        private const val CYCLONEDX_PLUGIN_ID = "org.cyclonedx.bom"
        private const val MAVEN_PUBLISH_PLUGIN_ID = "maven-publish"

        private const val STAGE_LEGAL_DOCUMENTS_TASK_NAME = "stageLegalDocuments"
        private const val VERIFY_JAR_CONTAINS_LEGAL_DOCUMENTS_TASK_NAME = "verifyJarContainsLegalDocuments"
        private const val META_INF_GLOB = "META-INF/**"
    }

    private fun applyPluginUnderTest(): Project {
        val project = ProjectBuilder.builder().build()
        project.pluginManager.apply(PLUGIN_ID)
        return project
    }

    private fun evaluateProject(project: Project) {
        (project as org.gradle.api.internal.project.ProjectInternal).evaluate()
    }

    @Test
    fun `should apply included plugins`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        expectedPlugins.forEach { pluginId ->
            project.pluginManager.hasPlugin(pluginId) shouldBe true
        }
    }

    @Test
    fun `should set correct java versions`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        val javaExtension = project.extensions.findByName("java")!! as DefaultJavaPluginExtension
        javaExtension.sourceCompatibility shouldBe JavaVersion.VERSION_21
        javaExtension.targetCompatibility shouldBe JavaVersion.VERSION_21
    }

    // These conventions cover neither SBOM generation nor publishing, so a module that applies them
    // must end up with neither plugin.
    @Test
    fun `should apply neither the SBOM nor the publishing plugins`() {
        // given/when
        val project = applyPluginUnderTest()
        evaluateProject(project)

        // then
        project.pluginManager.hasPlugin(CYCLONEDX_PLUGIN_ID) shouldBe false
        project.pluginManager.hasPlugin(MAVEN_PUBLISH_PLUGIN_ID) shouldBe false
    }

    @Test
    fun `should configure test tasks to use JUnit Platform`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        val testTask = project.tasks.findByName("test") as TestTask
        testTask.options.shouldBeInstanceOf<JUnitPlatformOptions>()
    }

    @Test
    fun `should configure the license header extension with the community source header and rules`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        val licenseHeaders = project.extensions.findByType(LicenseExtension::class.java)!!
        licenseHeaders.headerFile.get().asFile shouldBe project.rootProject.file("license_header")
        licenseHeaders.rules.get() shouldBe listOf(
            LicenseHeaderRule(".", ".kt", CommentStyle.BLOCK_COMMENT),
            LicenseHeaderRule(".", ".java", CommentStyle.BLOCK_COMMENT),
            LicenseHeaderRule(".", ".properties", CommentStyle.SCRIPT_STYLE),
        )
    }

    @Test
    fun `should order lintKotlinMain to run after formatKotlinMain`() {
        // given
        val project = applyPluginUnderTest()
        evaluateProject(project)

        // when
        val lintKotlinMain = project.tasks.getByName("lintKotlinMain")
        val formatKotlinMain = project.tasks.getByName("formatKotlinMain")

        // then
        lintKotlinMain.mustRunAfter.getDependencies(lintKotlinMain) shouldContain formatKotlinMain
    }

    /**
     * Wiring for the JVM-side legal-document conventions. Jar entry content and `WARN` emission need
     * a real task execution, which a `ProjectBuilder` test never reaches; they are covered by a
     * functional test.
     */
    @Nested
    inner class LegalDocumentConventions {

        @Test
        fun `should wire stageLegalDocuments into every Jar task via dependsOn`() {
            // given/when
            val project = applyPluginUnderTest()
            evaluateProject(project)

            // then
            jarTaskNames.forEach { taskName ->
                val jarTask = project.tasks.getByName(taskName)
                jarTask.taskDependencies.getDependencies(jarTask).map { it.name } shouldContain STAGE_LEGAL_DOCUMENTS_TASK_NAME
            }
        }

        @Test
        fun `should add the META-INF glob to a Jar task that already restricts its includes`() {
            // given
            val project = applyPluginUnderTest()
            val filteredJar = project.tasks.create("filteredJar", Jar::class.java) { it.include("**/*.class") }

            // when
            evaluateProject(project)

            // then
            filteredJar.includes shouldContain META_INF_GLOB
        }

        @Test
        fun `should not add any includes to a Jar task whose includes set is empty`() {
            // given/when
            val project = applyPluginUnderTest()
            evaluateProject(project)

            // then
            val jarTask = project.tasks.getByName("jar") as Jar
            jarTask.includes.shouldBeEmpty()
        }

        @Test
        fun `should register verifyJarContainsLegalDocuments depending on every Jar task and wire it into check`() {
            // given/when
            val project = applyPluginUnderTest()
            evaluateProject(project)

            // then
            val verifyTask = project.tasks.getByName(VERIFY_JAR_CONTAINS_LEGAL_DOCUMENTS_TASK_NAME)
            val verifyTaskDependencyNames = verifyTask.taskDependencies.getDependencies(verifyTask).map { it.name }
            jarTaskNames.forEach { verifyTaskDependencyNames shouldContain it }

            val check = project.tasks.getByName("check")
            check.taskDependencies.getDependencies(check).map { it.name } shouldContain VERIFY_JAR_CONTAINS_LEGAL_DOCUMENTS_TASK_NAME
        }
    }
}
