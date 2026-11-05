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

import com.mgmtp.a12.scripting.shared.api.exceptions.ScriptExecutionException
import com.mgmtp.a12.scripting.shared.internal.functions.logFailure
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import org.graalvm.polyglot.PolyglotException
import org.graalvm.polyglot.Value

/**
 * The single boundary at which a script execution failure is reported: it logs only the failure's kind
 * at warn level, keeps the full failure for debug level, and surfaces only the sanitized message.
 * Failure messages may quote personal data, so they never reach a level that production systems log.
 */
class ScriptExecutionFailureReporter(private val scriptFailureSanitizer: ScriptFailureSanitizer) {

    /**
     * Runs [executeScript] and reports whatever it throws.
     *
     * Must be called while the GraalVM context that runs the script is still open, because resolving
     * the failing script line reads context-bound state of the failure.
     *
     * @throws ScriptExecutionException for a failure of the script itself.
     */
    fun <T> logAndRethrowSanitizingScriptFailures(parsedScript: ParsedScript, executeScript: () -> T): T {
        try {
            return executeScript()
        } catch (failure: Throwable) {
            if (!isScriptFailure(failure)) {
                logger().logFailure(
                    "Script '{}' was cancelled, interrupted or failed outside the script itself",
                    failure,
                    parsedScript.scriptIdentifier,
                )
                throw failure
            }

            val sanitizedFailure = scriptFailureSanitizer.sanitizeScriptFailure(parsedScript, failure)
            logger().logFailure("Script '{}' failed", failure, parsedScript.scriptIdentifier)
            logFailureDetailAtDebug(parsedScript.scriptIdentifier, failure)
            throw ScriptExecutionException(sanitizedFailure)
        }
    }

    // GraalJS drops a JavaScript error's cause when it turns the error into a PolyglotException, so the
    // original Data Services failure behind a mapped A12 error is only reachable while the context is open.
    private fun logFailureDetailAtDebug(scriptIdentifier: String, failure: Throwable) {
        if (!logger().isDebugEnabled) return

        // Reading the cause can run a getter the script defines; its failure must not replace the sanitized one
        try {
            logGuestCauseAtDebug(scriptIdentifier, failure)
        } catch (causeReadFailure: PolyglotException) {
            if (causeReadFailure.isCancelled || causeReadFailure.isInterrupted) throw causeReadFailure
            logger().debug("Script '{}' failed with a cause that could not be read", scriptIdentifier, causeReadFailure)
        }
    }

    private fun logGuestCauseAtDebug(scriptIdentifier: String, failure: Throwable) {
        val guestCause = guestCauseOf(failure) ?: return

        val hostCause = guestCause.takeIf { it.isHostObject }?.asHostObject<Any>() as? Throwable
        if (hostCause != null) {
            logger().debug("Script '{}' failed caused by", scriptIdentifier, hostCause)
            return
        }

        // Rendered now: a Value can no longer be read once its context is closed
        logger().debug("Script '{}' failed caused by: {}", scriptIdentifier, guestCause.toString())
    }

    private fun guestCauseOf(failure: Throwable): Value? {
        if (failure !is PolyglotException || !failure.isGuestException) return null
        val guestError = failure.guestObject ?: return null
        if (!guestError.hasMember("cause")) return null

        return guestError.getMember("cause").takeUnless { it.isNull }
    }

    // A runaway script's Error and a cancelled or interrupted context are infrastructure events.
    // Reporting them as script failures would misattribute them, and wrapping a cancellation can
    // interfere with the context teardown that caused it.
    private fun isScriptFailure(failure: Throwable): Boolean = when {
        failure !is Exception -> false
        failure is PolyglotException && (failure.isCancelled || failure.isInterrupted) -> false
        else -> true
    }
}
