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

import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * Behavioural tests for [LegalDocumentPlaceholderDetector]: the placeholder marker and the
 * empty/dotfile-only `licenses/` directory are both detected and described with their path.
 */
private class LegalDocumentPlaceholderDetectorTest {

    companion object {
        private const val LICENSE_FILE_NAME = "LICENSE"
        private const val NOTICE_FILE_NAME = "NOTICE"
        private const val THIRD_PARTY_NOTICES_FILE_NAME = "THIRD_PARTY_NOTICES"
        private const val LICENSES_DIRECTORY_NAME = "licenses"
        private const val DOTFILE_IN_LICENSES = ".gitkeep"
        private const val NON_DOTFILE_IN_LICENSES = "some-dependency-LICENSE.txt"

        private const val REAL_LICENSE_TEXT = "Real LICENSE text"
        private const val REAL_NOTICE_TEXT = "Real NOTICE text"
        private const val REAL_THIRD_PARTY_NOTICES_TEXT = "Real THIRD_PARTY_NOTICES text"
    }

    @TempDir
    lateinit var directory: File

    private fun legalDocumentsWith(licensesDirectory: File): LegalDocuments = LegalDocuments(
        license = directory.resolve(LICENSE_FILE_NAME).apply { writeText(REAL_LICENSE_TEXT) },
        notice = directory.resolve(NOTICE_FILE_NAME).apply { writeText(REAL_NOTICE_TEXT) },
        thirdPartyNotices = directory.resolve(THIRD_PARTY_NOTICES_FILE_NAME).apply { writeText(REAL_THIRD_PARTY_NOTICES_TEXT) },
        licensesDirectory = licensesDirectory,
    )

    private fun realDocuments(): LegalDocuments {
        val licensesDirectory = directory.resolve(LICENSES_DIRECTORY_NAME).apply { mkdirs() }
        licensesDirectory.resolve(NON_DOTFILE_IN_LICENSES).writeText("Third-party licence text")
        return legalDocumentsWith(licensesDirectory)
    }

    @Test
    fun `should return no placeholders when every document has real content and licenses holds a non-dotfile`() {
        // given/when
        val descriptions = LegalDocumentPlaceholderDetector.describePlaceholders(realDocuments())

        // then
        descriptions.shouldBeEmpty()
    }

    @Test
    fun `should describe every document that still contains the placeholder marker, including its path`() {
        // given
        val documents = realDocuments()
        documents.license.writeText(LegalDocumentPlaceholderDetector.PLACEHOLDER_MARKER)
        documents.notice.writeText(LegalDocumentPlaceholderDetector.PLACEHOLDER_MARKER)

        // when
        val descriptions = LegalDocumentPlaceholderDetector.describePlaceholders(documents)

        // then
        descriptions shouldHaveSize 2
        descriptions.any { it.contains(documents.license.name) && it.contains(documents.license.path) } shouldBe true
        descriptions.any { it.contains(documents.notice.name) && it.contains(documents.notice.path) } shouldBe true
    }

    @Test
    fun `should describe the licenses directory as a placeholder when it holds only dotfiles`() {
        // given
        val licensesDirectory = directory.resolve(LICENSES_DIRECTORY_NAME).apply { mkdirs() }
        licensesDirectory.resolve(DOTFILE_IN_LICENSES).writeText("")
        val documents = legalDocumentsWith(licensesDirectory)

        // when
        val descriptions = LegalDocumentPlaceholderDetector.describePlaceholders(documents)

        // then
        descriptions shouldHaveSize 1
        descriptions.single() shouldContain licensesDirectory.path
    }

    @Test
    fun `should describe the licenses directory as a placeholder when it is empty`() {
        // given
        val licensesDirectory = directory.resolve(LICENSES_DIRECTORY_NAME).apply { mkdirs() }
        val documents = legalDocumentsWith(licensesDirectory)

        // when
        val descriptions = LegalDocumentPlaceholderDetector.describePlaceholders(documents)

        // then
        descriptions shouldHaveSize 1
        descriptions.single() shouldContain licensesDirectory.path
    }
}
