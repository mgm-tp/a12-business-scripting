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

package com.mgmtp.a12.scripting.shared.internal.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.nio.file.Path

@ConfigurationProperties(prefix = ScriptingProperties.PREFIX)
data class ScriptingProperties(
    val autoRegister: AutoRegister = AutoRegister(),
    val autoLoad: AutoLoad = AutoLoad(),
    val hotReload: HotReload = HotReload(),
    val errorMessages: ErrorMessages = ErrorMessages(),
    // No default: an application never starts with scripts loaded from somewhere the project did not state
    var scriptLocations: List<String>,
    var chunkNamePrefixes: List<String> = listOf("shared-lib-"),
) {

    companion object {
        const val PREFIX = "mgmtp.a12.scripting"

        // The one authoritative spelling of the key, so validation messages, resolver warnings and tests cannot drift
        const val SCRIPT_LOCATIONS_PROPERTY = "$PREFIX.script-locations"

        // Everything Spring's AntPathMatcher treats as a pattern, so a location cannot smuggle one past the check
        private val WILDCARD_CHARACTERS = setOf('*', '?', '{')
        private val TRAVERSAL_SEGMENTS = setOf(".", "..")
        private val LOCATION_SCHEME_PREFIXES = listOf("classpath*:", "classpath:", "file:")
    }

    // Normalized and validated here so that a misconfiguration fails at binding time, before any bean is created, and
    // every consumer reads the same value the validation judged
    init {
        require(scriptLocations.isNotEmpty()) { "$SCRIPT_LOCATIONS_PROPERTY must name at least one directory" }
        scriptLocations = scriptLocations.map(String::trim)
        scriptLocations.forEach(::requireValidLocationName)
    }

    /**
     * A valid location name denotes a directory: optional `classpath:`, `classpath*:` or `file:` scheme, non-empty, no
     * glob character (`*`, `?`, `{`), and no `.` or `..` segment. Together these also rule out every spelling that
     * normalizes to a root, which would silently widen the import sandbox to everything below it.
     */
    private fun requireValidLocationName(scriptLocation: String) {
        val locationPath = scriptLocation.withoutSchemePrefix().trimEnd('/')
        require(locationPath.isNotEmpty()) {
            "$SCRIPT_LOCATIONS_PROPERTY entry '$scriptLocation' must name a directory, " +
                "not a classpath or file system root"
        }
        require(locationPath.none(WILDCARD_CHARACTERS::contains)) {
            "$SCRIPT_LOCATIONS_PROPERTY entry '$scriptLocation' must be a directory; " +
                "a glob such as '/**/*.js' is not part of a location"
        }
        require(Path.of(locationPath).none { segment -> segment.toString() in TRAVERSAL_SEGMENTS }) {
            "$SCRIPT_LOCATIONS_PROPERTY entry '$scriptLocation' must not contain '.' or '..' segments; " +
                "name the directory the scripts actually lie in"
        }
    }

    // Only a known scheme is stripped, so 'classpath*:' stays usable while a '*' anywhere else is still rejected
    private fun String.withoutSchemePrefix(): String = LOCATION_SCHEME_PREFIXES
        .firstOrNull(::startsWith)
        ?.let { schemePrefix -> substring(schemePrefix.length) }
        ?: this

    data class AutoRegister(
        var enabled: Boolean = true,
    )

    data class AutoLoad(
        var enabled: Boolean = false,
    )

    data class HotReload(
        var enabled: Boolean = false,
    ) {
        companion object {
            const val PREFIX = "${ScriptingProperties.PREFIX}.hot-reload"
        }
    }

    /**
     * Governs how much detail surfaced script error messages carry.
     */
    data class ErrorMessages(
        /**
         * Whether surfaced script error messages name the script file and line the failure occurred in.
         * Off by default: the source location is a script-author diagnostic that a deployment opts into.
         */
        var includeSourceLocation: Boolean = false,
    ) {
        companion object {
            const val PREFIX = "${ScriptingProperties.PREFIX}.error-messages"
        }
    }
}
