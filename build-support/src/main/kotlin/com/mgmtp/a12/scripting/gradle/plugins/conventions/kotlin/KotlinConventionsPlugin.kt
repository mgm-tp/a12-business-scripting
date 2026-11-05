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

import com.mgmtp.a12.scripting.gradle.plugins.conventions.legal.LegalDocumentFileNames
import com.mgmtp.a12.scripting.gradle.plugins.conventions.legal.LegalDocumentPlaceholderDetector
import com.mgmtp.a12.scripting.gradle.plugins.conventions.legal.LegalDocumentResolver
import com.mgmtp.a12.scripting.gradle.plugins.conventions.legal.LegalDocuments
import com.mgmtp.a12.scripting.gradle.plugins.license.CommentStyle
import com.mgmtp.a12.scripting.gradle.plugins.license.LicenseExtension
import org.gradle.api.GradleException
import org.gradle.api.JavaVersion
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.RegularFile
import org.gradle.api.plugins.internal.DefaultJavaPluginExtension
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.Copy
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.bundling.Jar
import org.gradle.api.tasks.testing.Test
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile
import org.jmailen.gradle.kotlinter.tasks.LintTask
import java.io.File
import java.util.jar.JarFile

/**
 * Applies the Kotlin, lint and legal-document conventions every module of this repository gets:
 * the JVM toolchain, the lint and format tasks, and the legal documents every jar carries.
 */
class KotlinConventionsPlugin : Plugin<Project> {

    companion object {
        const val PLUGIN_ID = "com.mgmtp.a12.scripting.conventions.kotlin"

        private const val LINT_KOTLIN_TASK_NAME = "lintKotlin"
        private const val FORMAT_KOTLIN_TASK_NAME = "formatKotlin"
        internal const val CHECK_TASK_NAME = "check"

        private const val STAGE_LEGAL_DOCUMENTS_TASK_NAME = "stageLegalDocuments"
        private const val VERIFY_JAR_CONTAINS_LEGAL_DOCUMENTS_TASK_NAME = "verifyJarContainsLegalDocuments"
        private const val LEGAL_DOCUMENTS_STAGING_DIRECTORY = "tmp/legal-documents-staging"
        private const val LEGAL_DOCUMENTS_VERIFICATION_DIRECTORY = "tmp/legal-documents-verification"
        private const val META_INF_DIRECTORY = "META-INF"
        private const val META_INF_LICENSES_DIRECTORY = "META-INF/licenses"
        private const val META_INF_GLOB = "META-INF/**"
    }

    override fun apply(project: Project) {
        // Apply & configure license plugin
        project.pluginManager.apply("com.mgmtp.a12.scripting.license")
        project.extensions.getByType(LicenseExtension::class.java).apply {
            headerFile.set(project.rootProject.file("license_header"))
            rule(".kt", CommentStyle.BLOCK_COMMENT)
            rule(".java", CommentStyle.BLOCK_COMMENT)
            rule(".properties", CommentStyle.SCRIPT_STYLE)
        }

        // Apply plugins
        project.pluginManager.apply("org.jetbrains.kotlin.jvm")
        project.pluginManager.apply("java-library")
        project.pluginManager.apply("org.jmailen.kotlinter")
        project.tasks.named(LINT_KOTLIN_TASK_NAME) {
            it.dependsOn(FORMAT_KOTLIN_TASK_NAME)
        }

        // Order per-source-set tasks too: the lifecycle-level dependency above doesn't stop a
        // lintKotlin<X> task from running in parallel with, and before, its formatKotlin<X> task.
        project.tasks.withType(LintTask::class.java).configureEach { lintTask ->
            val formatTaskName = lintTask.name.replaceFirst(LINT_KOTLIN_TASK_NAME, FORMAT_KOTLIN_TASK_NAME)
            lintTask.mustRunAfter(formatTaskName)
        }

        // Configure java plugin
        (project.extensions.findByName("java")!! as DefaultJavaPluginExtension).apply {
            sourceCompatibility = JavaVersion.VERSION_21
            withJavadocJar()
            withSourcesJar()
        }

        project.tasks.withType(KotlinCompile::class.java) {
            it.compilerOptions {
                freeCompilerArgs.addAll("-Xjsr305=strict", "-java-parameters")
                jvmTarget.set(JvmTarget.JVM_21)
            }
        }

        configureLegalDocumentConventions(project)

        // Configure test tasks to use JUnit Platform
        project.tasks.withType(Test::class.java) {
            it.useJUnitPlatform()
        }
    }

    /**
     * Registers the JVM-side legal-document conventions: staging into every jar and a real-jar
     * presence check wired into `check`.
     */
    private fun configureLegalDocumentConventions(project: Project) {
        val resolvedDocuments: Provider<LegalDocuments> = project.provider {
            LegalDocumentResolver.resolvePreferringModuleLocalOrFail(project)
        }

        val stageLegalDocuments = registerStageLegalDocumentsTask(project, resolvedDocuments)

        // Deferred to afterEvaluate: a consuming build script may add its own includes() to a
        // Jar task anywhere in its body, so the includes.isNotEmpty() check must run only once
        // the whole script body has already been processed.
        project.afterEvaluate {
            project.tasks.withType(Jar::class.java).configureEach { jarTask ->
                jarTask.dependsOn(stageLegalDocuments)
                jarTask.from(project.layout.buildDirectory.dir(LEGAL_DOCUMENTS_STAGING_DIRECTORY))
                if (jarTask.includes.isNotEmpty()) {
                    jarTask.include(META_INF_GLOB)
                }
            }
        }

        val verifyJarContainsLegalDocuments = registerVerifyJarContainsLegalDocumentsTask(project, resolvedDocuments)
        project.tasks.named(CHECK_TASK_NAME) { it.dependsOn(verifyJarContainsLegalDocuments) }
    }

    private fun registerStageLegalDocumentsTask(project: Project, resolvedDocuments: Provider<LegalDocuments>): TaskProvider<Copy> =
        project.tasks.register(STAGE_LEGAL_DOCUMENTS_TASK_NAME, Copy::class.java) { task ->
            task.into(project.layout.buildDirectory.dir(LEGAL_DOCUMENTS_STAGING_DIRECTORY))
            task.from(resolvedDocuments.map { it.license }) { it.into(META_INF_DIRECTORY) }
            task.from(resolvedDocuments.map { it.notice }) { it.into(META_INF_DIRECTORY) }
            task.from(resolvedDocuments.map { it.thirdPartyNotices }) { it.into(META_INF_DIRECTORY) }
            task.from(resolvedDocuments.map { it.licensesDirectory }) { copySpec ->
                copySpec.into(META_INF_LICENSES_DIRECTORY)
                copySpec.exclude { element -> element.file.name.startsWith(".") }
            }
            task.doLast {
                LegalDocumentPlaceholderDetector.describePlaceholders(resolvedDocuments.get()).forEach { description ->
                    task.logger.warn("WARN: legal document placeholder detected: $description")
                }
            }
        }

    /**
     * Wired into `check`. Presence-only: it re-derives which `META-INF/licenses/<name>` entries
     * are expected from the currently resolved documents, then asserts every expected entry is
     * really present in each assembled jar -- catching an `includes`-filter or wiring
     * regression, not placeholder content (the placeholder verification's job).
     */
    private fun registerVerifyJarContainsLegalDocumentsTask(project: Project, resolvedDocuments: Provider<LegalDocuments>): TaskProvider<Task> {
        val jarArchiveFiles: ListProperty<RegularFile> = project.objects.listProperty(RegularFile::class.java)
        jarArchiveFiles.set(project.provider { project.tasks.withType(Jar::class.java).map { it.archiveFile.get() } })

        return project.tasks.register(VERIFY_JAR_CONTAINS_LEGAL_DOCUMENTS_TASK_NAME) { task ->
            task.dependsOn(project.tasks.withType(Jar::class.java))
            task.inputs.files(jarArchiveFiles)
            val markerFile = project.layout.buildDirectory.file("$LEGAL_DOCUMENTS_VERIFICATION_DIRECTORY/${project.name}.marker")
            task.outputs.file(markerFile)
            task.doLast {
                val expectedLicensesEntryNames = nonDotfileNamesIn(resolvedDocuments.get().licensesDirectory)
                verifyJarsContainLegalDocumentEntries(jarArchiveFiles.get().map { it.asFile }, expectedLicensesEntryNames)
                markerFile.get().asFile.apply {
                    parentFile.mkdirs()
                    writeText("verified")
                }
            }
        }
    }

    private fun nonDotfileNamesIn(directory: File): List<String> =
        directory.listFiles().orEmpty().filterNot { it.name.startsWith(".") }.map { it.name }

    private fun verifyJarsContainLegalDocumentEntries(jarFiles: List<File>, expectedLicensesEntryNames: List<String>) {
        val requiredEntries = listOf(
            "$META_INF_DIRECTORY/${LegalDocumentFileNames.LICENSE}",
            "$META_INF_DIRECTORY/${LegalDocumentFileNames.NOTICE}",
            "$META_INF_DIRECTORY/${LegalDocumentFileNames.THIRD_PARTY_NOTICES}",
        ) + expectedLicensesEntryNames.map { "$META_INF_LICENSES_DIRECTORY/$it" }

        jarFiles.forEach { jarFile ->
            JarFile(jarFile).use { jar ->
                val entryNames = jar.entries().asSequence().map { it.name }.toSet()
                val missingEntries = requiredEntries.filterNot(entryNames::contains)
                if (missingEntries.isNotEmpty()) {
                    throw GradleException("Jar '${jarFile.name}' is missing legal document entries: ${missingEntries.joinToString(", ")}")
                }
            }
        }
    }
}
