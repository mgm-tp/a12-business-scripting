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

package com.mgmtp.a12.scripting.shared.internal.processing.failure

import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import org.graalvm.polyglot.Source
import java.util.Base64
import kotlin.time.Clock

/** The parsed scripts whose failures the sanitizer and the reporter are tested on. */
internal object ParsedTestScripts {

    const val SCRIPT_NAME = "docNotFound"
    const val SCRIPT_FILE_NAME = "doc-not-found.js"
    const val TYPESCRIPT_FILE_NAME = "doc-not-found.ts"

    /** How the source map names the TypeScript source: with the directory it was built from. */
    const val TYPESCRIPT_SOURCE_PATH = "../system-test-scripts/src/$TYPESCRIPT_FILE_NAME"

    /** The TypeScript line the scripts' generated line 1 maps to. */
    const val FAILING_TYPESCRIPT_LINE = 6

    /** The directory the scripts are deployed in, which no failure statement may name. */
    const val SCRIPT_DIRECTORY = "/opt/app/scripts"

    const val SCRIPT_SOURCE_NAME = "file://$SCRIPT_DIRECTORY/$SCRIPT_FILE_NAME"

    /** Stands for personal data a failure may quote; no warning and no caller-facing message may contain it. */
    const val PERSONAL_DATA_MARKER = "Jane Doe"

    /** Maps generated line 1, and only that line, to line 6 of the single original source. */
    private const val SOURCE_MAP_MAPPINGS = "AAKA"

    private val SOURCE_MAP_JSON =
        """{"version":3,"sources":["$TYPESCRIPT_SOURCE_PATH"],"mappings":"$SOURCE_MAP_MAPPINGS","names":[]}"""

    private val INLINE_SOURCE_MAP_COMMENT =
        "//# sourceMappingURL=data:application/json;base64,${Base64.getEncoder().encodeToString(SOURCE_MAP_JSON.toByteArray())}"

    /** A script failing on its first line, carrying the inline map a development build emits. */
    fun throwingScriptWithInlineSourceMap(guestErrorMessage: String): ParsedScript = parsedScriptOf(sourceOf("throw new Error('$guestErrorMessage');\n$INLINE_SOURCE_MAP_COMMENT"))

    /** The same script as a build with the source maps switched off emits it. */
    fun throwingScriptWithoutSourceMap(guestErrorMessage: String): ParsedScript = parsedScriptOf(sourceOf("throw new Error('$guestErrorMessage');"))

    /** A script whose failing line the inline map holds no mapping for, so it cannot be resolved. */
    fun throwingScriptWithUnmappedFailingLine(guestErrorMessage: String): ParsedScript = parsedScriptOf(sourceOf("\nthrow new Error('$guestErrorMessage');\n$INLINE_SOURCE_MAP_COMMENT"))

    /** A script that does not fail, for the paths that never resolve a failing line. */
    fun scriptWithoutFailure(): ParsedScript = parsedScriptOf(sourceOf("export const execute = () => {};"))

    fun parsedScriptOf(source: Source) = ParsedScript(
        source = source,
        scriptFileName = SCRIPT_FILE_NAME,
        scriptIdentifier = SCRIPT_NAME,
        params = emptyMap(),
        returnProperties = emptyMap(),
        lastParsed = Clock.System.now(),
    )

    fun sourceOf(scriptText: String, sourceName: String = SCRIPT_SOURCE_NAME): Source = Source.newBuilder("js", scriptText, sourceName).build()
}
