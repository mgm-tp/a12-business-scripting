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

package com.mgmtp.a12.scripting.shared.internal.functions

import org.graalvm.polyglot.PolyglotException

/**
 * A resolved original source location from a source map.
 *
 * @param sourceFile The original source file name (e.g. "script.ts").
 * @param line 1-based line number in the original source.
 */
data class OriginalSourceLocation(
    val sourceFile: String,
    val line: Int,
)

/** Matches `at [async] <name> (<anything>:LINE:COL)` stack frame lines. */
private val STACK_FRAME_LINE_NUMBER = Regex("""\bat\s+(?:async\s+)?.+:(\d+):\d+\)?$""", RegexOption.MULTILINE)

/** Captures the JSON array content of the "sources" field. */
private val SOURCES_FIELD = Regex(""""sources"\s*:\s*\[([^\]]*)]""")

private const val VLQ_BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
private const val VLQ_CONTINUATION_BIT = 0x20
private const val VLQ_VALUE_MASK = 0x1F
private const val VLQ_SIGN_BIT = 0x01

/**
 * Resolves the script location an execution failure originates from, skipping the library frames.
 *
 * @param sourceMapJson The failing script's source map.
 * @return The original source location, or null for an unmapped line.
 */
fun findScriptCallSite(exception: PolyglotException, sourceMapJson: String): OriginalSourceLocation? {
    val fromTrace = exception.polyglotStackTrace
        .filter { it.isGuestFrame }
        .mapNotNull { frame ->
            val jsLine = frame.sourceLocation?.startLine ?: return@mapNotNull null
            remapLineFromSourceMap(sourceMapJson, jsLine)
        }.firstOrNull { !it.sourceFile.contains("business-scripting-core") }

    if (fromTrace != null) return fromTrace

    // Fallback for async errors: polyglotStackTrace loses frames across await boundaries.
    // Parse the JS Error's `stack` string which preserves async call chain frames.
    // Requires the GraalVM context to still be open (guestObject is context-bound).
    if (!exception.isGuestException) return null
    val stackStr = try {
        exception.guestObject
            ?.getMember("stack")
            ?.takeUnless { it.isNull }
            ?.asString()
    } catch (_: Exception) {
        null
    } ?: return null

    return STACK_FRAME_LINE_NUMBER
        .findAll(stackStr)
        .mapNotNull { it.groupValues[1].toIntOrNull() }
        .mapNotNull { remapLineFromSourceMap(sourceMapJson, it) }
        .firstOrNull { !it.sourceFile.contains("business-scripting-core") }
}

/**
 * Maps a generated (JS) line number back to the original (TS) source file and line.
 *
 * @param sourceMapJson The generated script's source map.
 * @param jsLine 1-based line number from the generated JS (e.g. from a PolyglotException stack frame).
 * @return The original source location, or null if the line is unmapped.
 */
fun remapLineFromSourceMap(sourceMapJson: String, jsLine: Int): OriginalSourceLocation? {
    val sources = parseSources(sourceMapJson)
    val mappings = parseMappings(sourceMapJson) ?: return null

    return resolveLocation(mappings, sources, jsLine)
}

private fun parseSources(sourceMapJson: String): List<String> {
    val sourcesContent = SOURCES_FIELD.find(sourceMapJson)?.groupValues?.get(1) ?: return emptyList()
    return sourcesContent
        .split(",")
        .map { it.trim().removeSurrounding("\"") }
        .filter { it.isNotEmpty() }
}

private fun parseMappings(sourceMapJson: String): String? = SOURCE_MAP_MAPPINGS_FIELD.find(sourceMapJson)?.groupValues?.get(1)

private fun resolveLocation(mappings: String, sources: List<String>, jsLine: Int): OriginalSourceLocation? {
    val lineGroups = mappings.split(";")
    val targetIndex = jsLine - 1 // convert to 0-based

    if (targetIndex < 0 || targetIndex >= lineGroups.size) return null

    // VLQ fields are cumulative across all segments in all lines
    var sourceFileIndex = 0
    var sourceLine = 0

    for (lineIndex in 0..targetIndex) {
        val group = lineGroups[lineIndex]
        if (group.isEmpty()) continue

        val segments = group.split(",")
        for (segment in segments) {
            val values = decodeVlqSegment(segment)
            if (values.size >= 4) {
                sourceFileIndex += values[1]
                sourceLine += values[2]
                // values[3] is source column delta — not needed for line mapping
            }
        }
    }

    // Check if the target line actually had a mapping
    val targetGroup = lineGroups[targetIndex]
    if (targetGroup.isEmpty()) return null

    val sourceFile = sources.getOrElse(sourceFileIndex) { "unknown" }
    return OriginalSourceLocation(sourceFile, sourceLine + 1) // convert back to 1-based
}

/**
 * Decodes a single VLQ segment (e.g. "AASA") into a list of signed integers.
 * Each segment encodes: [generatedColumn, sourceFileIndex, sourceLine, sourceColumn, nameIndex?].
 */
internal fun decodeVlqSegment(segment: String): List<Int> {
    val values = mutableListOf<Int>()
    var i = 0

    while (i < segment.length) {
        var result = 0
        var shift = 0

        do {
            val digit = VLQ_BASE64.indexOf(segment[i])
            if (digit == -1) return values
            result = result or ((digit and VLQ_VALUE_MASK) shl shift)
            shift += 5
            i++
        } while (digit and VLQ_CONTINUATION_BIT != 0 && i < segment.length)

        val isNegative = result and VLQ_SIGN_BIT != 0
        val value = result ushr 1
        values.add(if (isNegative) -value else value)
    }

    return values
}
