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

import org.graalvm.polyglot.Context
import org.graalvm.polyglot.HostAccess
import org.graalvm.polyglot.Source

internal const val DENIED_HOST_CLASS_NAME = "java.lang.ProcessBuilder"

/** Stated literally rather than read from the production constant, so a reworded message turns these tests red. */
internal const val HOST_CLASS_LOOKUP_API_GUIDANCE = "Scripts may only use the Java classes provided by the A12 scripting API."

internal fun scriptLookingUpADeniedHostClass(sourceName: String): Source = Source
    .newBuilder("js", "Java.type('$DENIED_HOST_CLASS_NAME');", sourceName)
    .build()

/**
 * Denies every lookup, which GraalJS words exactly as it words the rejection of a class outside
 * `ScriptAccessibleJavaClasses` — so the failure here is the one a script really produces.
 */
internal fun contextDenyingHostClassLookup(): Context = Context
    .newBuilder("js")
    .allowHostAccess(HostAccess.ALL)
    .allowHostClassLookup { false }
    .build()
