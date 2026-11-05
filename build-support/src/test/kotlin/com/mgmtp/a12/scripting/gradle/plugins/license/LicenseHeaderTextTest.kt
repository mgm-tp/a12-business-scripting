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

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

private class LicenseHeaderTextTest {

    private val headerLines = listOf("Copyright (c) 2026 Example Corp", "", "All rights reserved.")

    companion object {
        /**
         * Asciidoc block comments open and close with the same marker — the case that exposes
         * a strip implementation searching for the closing marker from index 0.
         */
        private val ASCIIDOC_STYLE = CommentStyle("////", "", "////")

        private const val OUTDATED_BLOCK_HEADER = "/*\n * Copyright (c) 2020 Old Corp\n */\n\n"
        private const val FILE_DOCUMENTATION_COMMENT = "/**\n * Documents what this file is for.\n */\n\n"
    }

    @Nested
    inner class HasHeader {

        @Test
        fun `should return true when block-comment header is present`() {
            // given
            val content = "/*\n * Copyright (c) 2026 Example Corp\n *\n * All rights reserved.\n */\n\npackage foo"

            // when
            val result = LicenseHeaderText.hasHeader(content, headerLines, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe true
        }

        @Test
        fun `should return false when block-comment header is absent`() {
            // given
            val content = "package foo\n\nclass Foo"

            // when
            val result = LicenseHeaderText.hasHeader(content, headerLines, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe false
        }

        @Test
        fun `should return true when script-style header is present`() {
            // given
            val content = "# Copyright (c) 2026 Example Corp\n#\n# All rights reserved.\n\nkey=value"

            // when
            val result = LicenseHeaderText.hasHeader(content, headerLines, CommentStyle.SCRIPT_STYLE)

            // then
            result shouldBe true
        }

        @Test
        fun `should return false when script-style header is absent`() {
            // given
            val content = "key=value\n"

            // when
            val result = LicenseHeaderText.hasHeader(content, headerLines, CommentStyle.SCRIPT_STYLE)

            // then
            result shouldBe false
        }
    }

    @Nested
    inner class ApplyHeader {

        @Test
        fun `should insert block-comment header into file without existing header`() {
            // given
            val content = "package foo\n\nclass Foo"

            // when
            val result = LicenseHeaderText.applyHeader(content, headerLines, CommentStyle.BLOCK_COMMENT)

            // then
            result.startsWith("/*\n * Copyright (c) 2026 Example Corp") shouldBe true
            result.contains("package foo") shouldBe true
        }

        @Test
        fun `should replace outdated block-comment copyright header`() {
            // given
            val content = OUTDATED_BLOCK_HEADER + "package foo\n"

            // when
            val result = LicenseHeaderText.applyHeader(content, headerLines, CommentStyle.BLOCK_COMMENT)

            // then
            result.contains("Old Corp") shouldBe false
            result.startsWith("/*\n * Copyright (c) 2026 Example Corp") shouldBe true
            result.contains("package foo") shouldBe true
        }

        @Test
        fun `should prepend header above a leading comment that is not a copyright header`() {
            // given
            val content = FILE_DOCUMENTATION_COMMENT + "package foo\n"

            // when
            val result = LicenseHeaderText.applyHeader(content, headerLines, CommentStyle.BLOCK_COMMENT)

            // then
            result.startsWith("/*\n * Copyright (c) 2026 Example Corp") shouldBe true
            result.contains("Documents what this file is for.") shouldBe true
        }

        @Test
        fun `should insert script-style header into file without existing header`() {
            // given
            val content = "key=value\n"

            // when
            val result = LicenseHeaderText.applyHeader(content, headerLines, CommentStyle.SCRIPT_STYLE)

            // then
            result.startsWith("# Copyright (c) 2026 Example Corp") shouldBe true
            result.contains("key=value") shouldBe true
        }

        @Test
        fun `should not double-apply header when already correct`() {
            // given
            val content = "/*\n * Copyright (c) 2026 Example Corp\n *\n * All rights reserved.\n */\n\npackage foo\n"

            // when
            // applyHeader always strips and re-applies; result should match hasHeader
            val result = LicenseHeaderText.applyHeader(content, headerLines, CommentStyle.BLOCK_COMMENT)

            // then
            LicenseHeaderText.hasHeader(result, headerLines, CommentStyle.BLOCK_COMMENT) shouldBe true
        }

        @Test
        fun `should replace outdated header when opening and closing markers are identical`() {
            // given
            val content = "////\nCopyright (c) 2020 Old Corp\n////\n\n= Title\n"

            // when
            val result = LicenseHeaderText.applyHeader(content, headerLines, ASCIIDOC_STYLE)

            // then
            result.contains("Old Corp") shouldBe false
            LicenseHeaderText.hasHeader(result, headerLines, ASCIIDOC_STYLE) shouldBe true
            result.contains("= Title") shouldBe true
        }
    }

    @Nested
    inner class StripExistingHeader {

        @Test
        fun `should strip block-comment copyright header`() {
            // given
            val content = OUTDATED_BLOCK_HEADER + "package foo\n"

            // when
            val result = LicenseHeaderText.stripExistingHeader(content, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe "package foo\n"
        }

        @Test
        fun `should return unchanged content when no block-comment opener found`() {
            // given
            val content = "package foo\n"

            // when
            val result = LicenseHeaderText.stripExistingHeader(content, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe "package foo\n"
        }

        @Test
        fun `should keep a leading block comment that is not a copyright header`() {
            // given
            val content = FILE_DOCUMENTATION_COMMENT + "package foo\n"

            // when
            val result = LicenseHeaderText.stripExistingHeader(content, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe content
        }

        @Test
        fun `should strip script-style copyright header`() {
            // given
            val content = "# Copyright (c) 2020 Old Corp\n#\n# All rights reserved.\n\nkey=value\n"

            // when
            val result = LicenseHeaderText.stripExistingHeader(content, CommentStyle.SCRIPT_STYLE)

            // then
            result shouldBe "key=value\n"
        }

        @Test
        fun `should keep leading commented-out settings that are not a copyright header`() {
            // given
            // A .properties file may start with a disabled setting; deleting it would change behaviour.
            val content = "# feature.enabled=false\n\nkey=value\n"

            // when
            val result = LicenseHeaderText.stripExistingHeader(content, CommentStyle.SCRIPT_STYLE)

            // then
            result shouldBe content
        }

        @Test
        fun `should strip header when opening and closing markers are identical`() {
            // given
            val content = "////\nCopyright (c) 2020 Old Corp\n////\n\n= Title\n"

            // when
            val result = LicenseHeaderText.stripExistingHeader(content, ASCIIDOC_STYLE)

            // then
            result shouldBe "= Title\n"
        }
    }

    @Nested
    inner class StartsWithCommentWithoutCopyrightMarker {

        @Test
        fun `should return true for a leading comment that is not a copyright header`() {
            // given
            val content = FILE_DOCUMENTATION_COMMENT + "package foo\n"

            // when
            val result = LicenseHeaderText.startsWithCommentWithoutCopyrightMarker(content, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe true
        }

        @Test
        fun `should return false for a leading copyright header`() {
            // given
            val content = OUTDATED_BLOCK_HEADER + "package foo\n"

            // when
            val result = LicenseHeaderText.startsWithCommentWithoutCopyrightMarker(content, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe false
        }

        @Test
        fun `should return false when the file does not start with a comment`() {
            // given
            val content = "package foo\n"

            // when
            val result = LicenseHeaderText.startsWithCommentWithoutCopyrightMarker(content, CommentStyle.BLOCK_COMMENT)

            // then
            result shouldBe false
        }
    }
}
