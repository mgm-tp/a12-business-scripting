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

package com.mgmtp.a12.scripting.shared.debugging.extension.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Configuration properties for GraalJS script debugging via Chrome DevTools.
 */
@ConfigurationProperties(prefix = "mgmtp.a12.scripting.debugging")
data class ScriptDebugProperties(
    /** Enable Chrome DevTools debugging. */
    var enabled: Boolean = false,
    /** Inspector bind address: a bare port binds loopback only, `host:port` binds that host. */
    var port: String = "4242",
    /** Block until a debugger connects. This also makes sure that all scripts are shown to be debugged. */
    var waitAttached: Boolean = true,
    /** Pause at first statement. */
    var suspendOnStart: Boolean = false,
) {
    /**
     * Returns GraalJS engine-level options for Chrome DevTools debugging.
     *
     * The inspector is always plaintext: left unset, GraalVM requires a TLS keystore for every non-loopback bind.
     */
    fun graalEngineOptions(): Map<String, String> {
        if (!enabled) return emptyMap()
        return mapOf(
            "inspect" to port,
            "inspect.Suspend" to suspendOnStart.toString(),
            "inspect.WaitAttached" to waitAttached.toString(),
            "inspect.Secure" to "false",
        )
    }
}
