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

package com.mgmtp.a12.scripting.gradle.plugins.conventions.legal

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * Behavioural tests for [LegalDocumentResolver]: per-document module-local override on the JVM
 * side, and no-silent-absence failures that name every missing document and searched path.
 */
private class LegalDocumentResolverTest {

    companion object {
        private const val LICENSE_FILE_NAME = "LICENSE"
        private const val NOTICE_FILE_NAME = "NOTICE"
        private const val THIRD_PARTY_NOTICES_FILE_NAME = "THIRD_PARTY_NOTICES"
        private const val LICENSES_DIRECTORY_NAME = "licenses"
        private const val NON_DOTFILE_IN_LICENSES = "some-dependency-LICENSE.txt"

        private const val ROOT_LICENSE_TEXT = "Root LICENSE text"
        private const val ROOT_NOTICE_TEXT = "Root NOTICE text"
        private const val ROOT_THIRD_PARTY_NOTICES_TEXT = "Root THIRD_PARTY_NOTICES text"
        private const val MODULE_NOTICE_TEXT = "Module-local NOTICE text"
    }

    @TempDir
    lateinit var rootDirectory: File

    private fun writeRootLegalDocuments() {
        rootDirectory.resolve(LICENSE_FILE_NAME).writeText(ROOT_LICENSE_TEXT)
        rootDirectory.resolve(NOTICE_FILE_NAME).writeText(ROOT_NOTICE_TEXT)
        rootDirectory.resolve(THIRD_PARTY_NOTICES_FILE_NAME).writeText(ROOT_THIRD_PARTY_NOTICES_TEXT)
        rootDirectory.resolve(LICENSES_DIRECTORY_NAME).apply { mkdirs() }
            .resolve(NON_DOTFILE_IN_LICENSES).writeText("Third-party licence text")
    }

    private fun rootProject(): Project = ProjectBuilder.builder().withProjectDir(rootDirectory).build()

    private fun moduleProjectIn(rootProject: Project, moduleName: String = "module"): Project {
        val moduleDirectory = File(rootDirectory, moduleName).apply { mkdirs() }
        return ProjectBuilder.builder().withParent(rootProject).withProjectDir(moduleDirectory).build()
    }

    @Nested
    inner class ResolveFromRootOrFail {

        @Test
        fun `should resolve all four documents from the repository root`() {
            // given
            writeRootLegalDocuments()
            val project = rootProject()

            // when
            val documents = LegalDocumentResolver.resolveFromRootOrFail(project)

            // then
            documents.license.readText() shouldBe ROOT_LICENSE_TEXT
            documents.notice.readText() shouldBe ROOT_NOTICE_TEXT
            documents.thirdPartyNotices.readText() shouldBe ROOT_THIRD_PARTY_NOTICES_TEXT
            documents.licensesDirectory shouldBe rootDirectory.resolve(LICENSES_DIRECTORY_NAME)
        }

        @Test
        fun `should fail naming the missing document and its searched path when it is absent from the root`() {
            // given: THIRD_PARTY_NOTICES is missing
            writeRootLegalDocuments()
            val missingDocument = rootDirectory.resolve(THIRD_PARTY_NOTICES_FILE_NAME)
            missingDocument.delete()
            val project = rootProject()

            // when
            val exception = shouldThrow<GradleException> { LegalDocumentResolver.resolveFromRootOrFail(project) }

            // then
            exception.message shouldContain THIRD_PARTY_NOTICES_FILE_NAME
            exception.message shouldContain missingDocument.path
        }

        @Test
        fun `should name every missing document when none exist at the root`() {
            // given
            val project = rootProject()

            // when
            val exception = shouldThrow<GradleException> { LegalDocumentResolver.resolveFromRootOrFail(project) }

            // then
            exception.message shouldContain LICENSE_FILE_NAME
            exception.message shouldContain NOTICE_FILE_NAME
            exception.message shouldContain THIRD_PARTY_NOTICES_FILE_NAME
            exception.message shouldContain LICENSES_DIRECTORY_NAME
        }
    }

    @Nested
    inner class ResolvePreferringModuleLocalOrFail {

        @Test
        fun `should use the module-local NOTICE while still resolving the other three documents from the root`() {
            // given: resolution is per document, not all-or-nothing
            writeRootLegalDocuments()
            val moduleProject = moduleProjectIn(rootProject())
            moduleProject.projectDir.resolve(NOTICE_FILE_NAME).writeText(MODULE_NOTICE_TEXT)

            // when
            val documents = LegalDocumentResolver.resolvePreferringModuleLocalOrFail(moduleProject)

            // then
            documents.notice.readText() shouldBe MODULE_NOTICE_TEXT
            documents.license.readText() shouldBe ROOT_LICENSE_TEXT
            documents.thirdPartyNotices.readText() shouldBe ROOT_THIRD_PARTY_NOTICES_TEXT
            documents.licensesDirectory shouldBe rootDirectory.resolve(LICENSES_DIRECTORY_NAME)
        }

        @Test
        fun `should use the module-local licenses directory when the module has its own`() {
            // given
            writeRootLegalDocuments()
            val moduleProject = moduleProjectIn(rootProject())
            val moduleLicensesDirectory = moduleProject.projectDir.resolve(LICENSES_DIRECTORY_NAME).apply { mkdirs() }
            moduleLicensesDirectory.resolve("module-only-LICENSE.txt").writeText("Module-only licence text")

            // when
            val documents = LegalDocumentResolver.resolvePreferringModuleLocalOrFail(moduleProject)

            // then
            documents.licensesDirectory shouldBe moduleLicensesDirectory
        }

        @Test
        fun `should fall back to the root documents when the module has none of its own`() {
            // given
            writeRootLegalDocuments()
            val moduleProject = moduleProjectIn(rootProject())

            // when
            val documents = LegalDocumentResolver.resolvePreferringModuleLocalOrFail(moduleProject)

            // then
            documents.license.readText() shouldBe ROOT_LICENSE_TEXT
            documents.notice.readText() shouldBe ROOT_NOTICE_TEXT
            documents.thirdPartyNotices.readText() shouldBe ROOT_THIRD_PARTY_NOTICES_TEXT
        }

        @Test
        fun `should fail naming the missing documents when absent from both module and root`() {
            // given: only NOTICE and an empty licenses directory exist anywhere
            rootDirectory.resolve(NOTICE_FILE_NAME).writeText(ROOT_NOTICE_TEXT)
            rootDirectory.resolve(LICENSES_DIRECTORY_NAME).mkdirs()
            val moduleProject = moduleProjectIn(rootProject())

            // when
            val exception = shouldThrow<GradleException> {
                LegalDocumentResolver.resolvePreferringModuleLocalOrFail(moduleProject)
            }

            // then
            exception.message shouldContain LICENSE_FILE_NAME
            exception.message shouldContain THIRD_PARTY_NOTICES_FILE_NAME
        }
    }
}
