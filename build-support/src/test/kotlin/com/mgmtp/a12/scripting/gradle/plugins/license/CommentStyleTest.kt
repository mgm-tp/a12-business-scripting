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
import org.junit.jupiter.api.Test

private class CommentStyleTest {

    private val headerLines = listOf("Copyright (c) 2026 Example Corp", "", "All rights reserved.")

    @Test
    fun `should wrap lines correctly using BLOCK_COMMENT`() {
        // when
        val result = CommentStyle.BLOCK_COMMENT.wrap(headerLines)

        // then
        result shouldBe "/*\n * Copyright (c) 2026 Example Corp\n *\n * All rights reserved.\n */\n"
    }

    @Test
    fun `should wrap lines correctly using SCRIPT_STYLE`() {
        // when
        val result = CommentStyle.SCRIPT_STYLE.wrap(headerLines)

        // then
        result shouldBe "# Copyright (c) 2026 Example Corp\n#\n# All rights reserved.\n"
    }

    @Test
    fun `should not add trailing whitespace on blank lines using BLOCK_COMMENT`() {
        // when
        val result = CommentStyle.BLOCK_COMMENT.wrap(listOf("Line 1", "", "Line 3"))

        // then
        val lines = result.lines()
        lines[2] shouldBe " *"
    }

    @Test
    fun `should not add trailing whitespace on blank lines using SCRIPT_STYLE`() {
        // when
        val result = CommentStyle.SCRIPT_STYLE.wrap(listOf("Line 1", "", "Line 3"))

        // then
        val lines = result.lines()
        lines[1] shouldBe "#"
    }
}
