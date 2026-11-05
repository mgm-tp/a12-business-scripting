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

import org.slf4j.Logger
import org.slf4j.LoggerFactory

// getLogger uses map/cache internally to retrieve logger efficiently, no need to cache here
inline fun <reified R : Any> R.logger(): Logger = LoggerFactory.getLogger(
    this::class.java.name
        .substringBefore("\$Companion"),
)

/**
 * Logs [failure] so that its message, which may quote personal data, never reaches a level above debug:
 * the warning names only the failure's kind, the debug entry carries the full failure.
 */
fun Logger.logFailure(message: String, failure: Throwable, vararg messageArguments: Any?) {
    warn("$message ({})", *messageArguments, failureKindOf(failure))
    debug(message, *messageArguments, failure)
}

// Anonymous classes have no simple name, so the qualified one is used instead.
private fun failureKindOf(failure: Throwable): String = failure::class.java.simpleName.ifEmpty { failure::class.java.name }
