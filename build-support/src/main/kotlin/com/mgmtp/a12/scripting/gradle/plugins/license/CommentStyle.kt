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

import java.io.Serializable

/**
 * Defines how a copyright header is wrapped in comment markers for a specific file type.
 *
 * @property firstLine the opening line of the comment block (e.g. "/*"), or null for line-comment styles
 * @property linePrefix the prefix applied to every content line (e.g. " * ")
 * @property lastLine the closing line of the comment block (e.g. " */"), or null for line-comment styles
 */
data class CommentStyle(
    val firstLine: String?,
    val linePrefix: String,
    val lastLine: String?
) : Serializable {

    companion object {
        /** Block comment style used for Java, Kotlin, Groovy, and similar JVM languages. */
        val BLOCK_COMMENT = CommentStyle(
            firstLine = "/*",
            linePrefix = " * ",
            lastLine = " */"
        )

        /** Hash/script comment style used for .properties and shell-like files. */
        val SCRIPT_STYLE = CommentStyle(
            firstLine = null,
            linePrefix = "# ",
            lastLine = null
        )

        /** XML/HTML comment style. */
        val XML_STYLE = CommentStyle(
            firstLine = "<!--",
            linePrefix = "  ",
            lastLine = "-->"
        )
    }

    /**
     * Wraps the given plain-text header lines into a comment block using this style.
     */
    fun wrap(headerLines: List<String>): String {
        val sb = StringBuilder()
        if (firstLine != null) {
            sb.appendLine(firstLine)
        }
        for (line in headerLines) {
            val contentPart = line.trimEnd()
            if (contentPart.isEmpty()) {
                // Avoid trailing whitespace on blank comment lines
                sb.appendLine(linePrefix.trimEnd())
            } else {
                sb.appendLine("$linePrefix$contentPart")
            }
        }
        if (lastLine != null) {
            sb.appendLine(lastLine)
        }
        return sb.toString()
    }
}
