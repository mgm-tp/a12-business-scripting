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

/**
 * A `:line` or `:line:column` suffix. The script engine appends both: a syntax error message reads
 * `SyntaxError: file:///opt/app/scripts/broken.js:1:10 Expected an operand but found ;`.
 */
private const val LINE_AND_COLUMN_PATTERN = """(?::\d+){1,2}"""

/** Characters that never belong to a path, so they delimit one inside a message. */
private const val PATH_DELIMITERS = """\s'"()\[\]"""

/**
 * The directory part of a script location — matched only when a script file name follows, so that
 * paths which are the message itself (a document reference, a field path) stay untouched.
 */
private val SCRIPT_LOCATION_DIRECTORY_PART = Regex(
    """[^$PATH_DELIMITERS]*/(?=[^$PATH_DELIMITERS/]+$SCRIPT_FILE_EXTENSION_PATTERN(?:$LINE_AND_COLUMN_PATTERN)?)""",
)

private val SCRIPT_FILE_NAME_WITH_LINE_AND_COLUMN = Regex("""($SCRIPT_FILE_EXTENSION_PATTERN)$LINE_AND_COLUMN_PATTERN""")

/**
 * Reduces every script location in [text] — a `file:`/`jar:` URI or any `.js`/`.ts` path — to its
 * file name, so that no directory reaches the caller. Any `:line[:column]` suffix is kept.
 */
fun reduceScriptLocationsToFileName(text: String): String = SCRIPT_LOCATION_DIRECTORY_PART.replace(text, "")

/**
 * Removes the `:line[:column]` suffix from every script location in [text], for deployments that do
 * not expose source locations.
 */
fun dropLineAndColumnFromScriptLocations(text: String): String = SCRIPT_FILE_NAME_WITH_LINE_AND_COLUMN.replace(text, "\$1")
