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

package com.mgmtp.a12.scripting.shared.api.exceptions

/**
 * A script execution failure reduced to what its caller may see.
 *
 * @param scriptIdentifier The script's file name, or its script name where no file name can be derived.
 * @param failureCallSite Where in the script the failure occurred (e.g. `doc-not-found.ts:6`), or
 *   `null` when the deployment does not expose source locations.
 * @param causeText The failure's own message, with script directories already removed.
 */
data class SanitizedScriptFailure(
    val scriptIdentifier: String,
    val failureCallSite: String?,
    val causeText: String,
) {
    /** Names the script that failed and, where the deployment exposes it, the line it failed at. */
    val title: String get() = failureCallSite?.let { "Script '$scriptIdentifier' failed at $it" } ?: "Script '$scriptIdentifier' failed"

    /** What made the script fail. A script that failed because it called another script reports that script's chain here. */
    val description: String get() = causeText

    /**
     * Title and description in one line, for callers that carry a single message (e.g. a workflow incident).
     * Each nesting level of a script call contributes one `caused by` link, so the chain stays readable.
     */
    val singleLineMessage: String get() = "$title caused by: $description"
}
