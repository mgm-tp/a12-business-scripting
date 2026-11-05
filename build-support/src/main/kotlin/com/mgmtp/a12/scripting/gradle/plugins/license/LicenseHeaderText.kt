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

/**
 * Renders the copyright header as a comment block, and detects, strips or replaces that block
 * at the top of a source file's content.
 */
object LicenseHeaderText {

    /**
     * Markers that identify a leading comment block as a copyright header. Only a block that
     * carries one of them may be stripped, so unrelated leading comments survive.
     */
    private val COPYRIGHT_MARKERS = listOf("SPDX-License-Identifier", "Copyright")

    /**
     * Returns the generated comment block for [headerLines] using [style].
     */
    fun buildCommentBlock(headerLines: List<String>, style: CommentStyle): String =
        style.wrap(headerLines)

    /**
     * Returns true if [fileContent] begins with exactly the comment block that [headerLines]
     * and [style] render to.
     *
     * Line endings in [fileContent] are normalised to `\n` before comparison so that
     * files with Windows-style `\r\n` endings are handled correctly.
     */
    fun hasHeader(fileContent: String, headerLines: List<String>, style: CommentStyle): Boolean {
        val normalised = fileContent.replace("\r\n", "\n")
        val rendered = buildCommentBlock(headerLines, style)
        return normalised.startsWith(rendered)
    }

    /**
     * Returns true if [fileContent] starts with a comment in [style] that carries none of the
     * [COPYRIGHT_MARKERS], i.e. a comment that [stripExistingHeader] deliberately keeps.
     *
     * Callers use this to report that a header was prepended above an existing comment.
     */
    fun startsWithCommentWithoutCopyrightMarker(fileContent: String, style: CommentStyle): Boolean {
        val leadingComment = findLeadingComment(fileContent, style) ?: return false
        return !containsCopyrightMarker(leadingComment.text)
    }

    /**
     * Strips the copyright header comment from the top of [fileContent] so a fresh one can be
     * prepended.
     *
     * Only a leading comment in [style] that carries one of the [COPYRIGHT_MARKERS] is removed.
     * Any other leading comment — a file-level KDoc, a commented-out property — is kept, because
     * deleting it would silently discard content that the header has nothing to do with.
     */
    fun stripExistingHeader(fileContent: String, style: CommentStyle): String {
        val leadingComment = findLeadingComment(fileContent, style) ?: return fileContent
        if (!containsCopyrightMarker(leadingComment.text)) return fileContent
        return fileContent.substring(leadingComment.endIndex).trimStart('\r', '\n')
    }

    /**
     * Returns [fileContent] with [headerLines] applied using [style].
     * An existing copyright header in the same comment style is replaced.
     */
    fun applyHeader(fileContent: String, headerLines: List<String>, style: CommentStyle): String {
        val stripped = stripExistingHeader(fileContent, style)
        val newHeader = buildCommentBlock(headerLines, style)
        return if (stripped.isBlank()) {
            newHeader
        } else {
            "$newHeader\n$stripped"
        }
    }

    /** A comment block at the very top of a file, and the index just past its last character. */
    private data class LeadingComment(val text: String, val endIndex: Int)

    private fun findLeadingComment(fileContent: String, style: CommentStyle): LeadingComment? =
        if (style.firstLine != null) {
            findLeadingBlockComment(fileContent, style.firstLine, style.lastLine!!)
        } else {
            findLeadingLineComments(fileContent, style.linePrefix.trimEnd())
        }

    private fun findLeadingBlockComment(fileContent: String, firstLine: String, lastLine: String): LeadingComment? {
        if (!fileContent.startsWith(firstLine)) return null
        // Search past the opening marker: styles such as asciidoc's "////" open and close with
        // the same text, so searching from index 0 would match the opener as its own closer.
        val closeIndex = fileContent.indexOf(lastLine, firstLine.length)
        if (closeIndex < 0) return null
        val endIndex = closeIndex + lastLine.length
        return LeadingComment(fileContent.substring(0, endIndex), endIndex)
    }

    private fun findLeadingLineComments(fileContent: String, commentPrefix: String): LeadingComment? {
        var endIndex = 0
        while (endIndex < fileContent.length) {
            if (!fileContent.startsWith(commentPrefix, endIndex)) break
            val lineBreakIndex = fileContent.indexOf('\n', endIndex)
            endIndex = if (lineBreakIndex < 0) fileContent.length else lineBreakIndex + 1
        }
        if (endIndex == 0) return null
        return LeadingComment(fileContent.substring(0, endIndex), endIndex)
    }

    private fun containsCopyrightMarker(commentBlock: String): Boolean =
        COPYRIGHT_MARKERS.any { commentBlock.contains(it) }
}
