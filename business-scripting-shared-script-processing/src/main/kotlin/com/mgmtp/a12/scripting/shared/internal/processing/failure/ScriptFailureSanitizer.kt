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

import com.mgmtp.a12.scripting.shared.api.exceptions.SanitizedScriptFailure
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.functions.findScriptCallSite
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import org.graalvm.polyglot.PolyglotException

/**
 * Reduces a script execution failure to what its caller may see: it names the script, resolves the
 * failing script line where the deployment exposes source locations, replaces GraalJS's host class
 * lookup rejection with the scripting API guidance, reduces an error of a built-in JavaScript type to its name,
 * and removes script directories from the cause text.
 *
 * The only place the source-location setting is read.
 */
class ScriptFailureSanitizer(private val scriptingProperties: ScriptingProperties) {

    /**
     * Must be called while the GraalVM context that ran the script is still open, because resolving
     * the failing script line reads context-bound state of [failureCause].
     */
    fun sanitizeScriptFailure(parsedScript: ParsedScript, failureCause: Throwable) = SanitizedScriptFailure(
        scriptIdentifier = deriveScriptFileName(parsedScript.source.name) ?: parsedScript.scriptIdentifier,
        failureCallSite = if (scriptingProperties.errorMessages.includeSourceLocation) findFailureCallSite(failureCause, parsedScript) else null,
        causeText = sanitizeCauseText(failureCause),
    )

    /**
     * For a boundary that catches a failure the script source is no longer available for, so the failing
     * script line cannot be resolved. Names the script by the name the caller addressed it with.
     */
    fun sanitizeScriptFailureWithoutSource(scriptName: String, failureCause: Throwable) = SanitizedScriptFailure(
        scriptIdentifier = scriptName,
        failureCallSite = null,
        causeText = sanitizeCauseText(failureCause),
    )

    private fun sanitizeCauseText(failureCause: Throwable): String {
        // A failure without a message would otherwise surface as "null"
        val causeText = failureCause.message?.takeIf { it.isNotBlank() } ?: failureCause::class.java.simpleName
        // Before any other rule, so that no later one ever sees the rejected class name or a runtime value.
        val causeTextWithoutEngineDetail = sanitizeGraalJsErrorMessage(failureCause, causeText)
        val causeTextWithoutDirectories = reduceScriptLocationsToFileName(causeTextWithoutEngineDetail)

        if (scriptingProperties.errorMessages.includeSourceLocation) return causeTextWithoutDirectories

        return dropLineAndColumnFromScriptLocations(causeTextWithoutDirectories)
    }

    private fun findFailureCallSite(failureCause: Throwable, parsedScript: ParsedScript): String? {
        if (failureCause !is PolyglotException) return null

        val sourceMap = parsedScript.sourceMap ?: return null
        val callSite = findScriptCallSite(failureCause, sourceMap) ?: return null

        return "${reduceScriptLocationsToFileName(callSite.sourceFile)}:${callSite.line}"
    }
}
