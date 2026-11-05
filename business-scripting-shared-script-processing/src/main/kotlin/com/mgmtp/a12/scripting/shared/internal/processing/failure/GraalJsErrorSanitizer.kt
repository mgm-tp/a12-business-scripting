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

import org.graalvm.polyglot.PolyglotException

/**
 * GraalJS's wording when a context refuses a host class lookup, as `js-language` 25.0.0 phrases it. A language
 * upgrade that rewords it turns `GraalJsErrorSanitizerTest` red rather than leaking the rejected class name,
 * because that test matches against the message a real rejection produces.
 */
private val HOST_CLASS_LOOKUP_REJECTION = Regex("""Access to host class \S+? is not allowed or does not exist\.""")

/**
 * States the closed set without naming its contents or the allowlist behind it. It covers both halves of the
 * rejection GraalJS words as one: a class outside the set, and one inside it that the deployment does not carry.
 */
private const val API_GUIDANCE = "Scripts may only use the Java classes provided by the A12 scripting API."

/**
 * JavaScript's built-in error types, which GraalJS raises itself, with the message after the name. A script
 * throwing one of them is reduced too.
 */
private val ENGINE_ERROR_WITH_MESSAGE =
    Regex("""^(EvalError|RangeError|ReferenceError|SyntaxError|TypeError|URIError|AggregateError): .*""", RegexOption.DOT_MATCHES_ALL)

/**
 * Removes from [text], the message of [failure], what GraalJS's own wording may expose: a host class lookup
 * rejection becomes guidance naming the scripting API, and an error of a built-in JavaScript type is reduced
 * to its name, because its message may quote the values the script was working on.
 */
fun sanitizeGraalJsErrorMessage(failure: Throwable, text: String): String {
    // The rejection is itself an engine TypeError, so its guidance must be applied before the reduction.
    if (HOST_CLASS_LOOKUP_REJECTION.containsMatchIn(text)) return HOST_CLASS_LOOKUP_REJECTION.replace(text, API_GUIDANCE)

    return reduceEngineErrorToItsName(failure, text)
}

private fun reduceEngineErrorToItsName(failure: Throwable, text: String): String {
    if (failure !is PolyglotException || !failure.isGuestException) return text

    return ENGINE_ERROR_WITH_MESSAGE.matchEntire(text)?.groupValues?.get(1) ?: text
}
