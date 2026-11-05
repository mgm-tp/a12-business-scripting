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

package com.mgmtp.a12.scripting.shared.internal.processing.eval

import com.mgmtp.a12.scripting.shared.internal.functions.extractSourceMapJson
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import org.graalvm.polyglot.Source
import java.nio.file.Path
import kotlin.time.Instant

class ParsedScript(
    val source: Source,
    /** The script's file name, how error messages and logs identify it. */
    val scriptFileName: String,
    /** How callers address the script: its file name in camel case, without the extension. */
    val scriptIdentifier: String,
    val params: Map<String, String>,
    val returnProperties: Map<String, String>,
    val lastParsed: Instant,
    // Captured at parse time so each invocation's fresh Context resolves
    // relative ES-module imports against the script's own directory.
    val currentWorkingDirectory: Path? = null,
) {
    /**
     * The script's inline source map as JSON, `null` for a script built without one — a build with
     * the source maps switched off — or with one that cannot be decoded. Extracted once per parse
     * instead of per frame of every failure.
     */
    val sourceMap: String? = extractSourceMapJsonOrWarn()

    // A map that cannot be decoded only costs the script line in failure reports, so it must not keep
    // the script from registering.
    private fun extractSourceMapJsonOrWarn(): String? = try {
        extractSourceMapJson(source.characters.toString())
    } catch (undecodableSourceMap: IllegalArgumentException) {
        logger().warn(
            "Script '{}' carries an inline source map that cannot be decoded, so its failures name no script line: {}",
            scriptFileName,
            undecodableSourceMap.message,
        )
        null
    }
}
