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

import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import java.io.File
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

class ScriptRegistry(
    private val scriptingProperties: ScriptingProperties,
    private val scriptEvaluator: ScriptEvaluator,
    private val scriptTypeDescription: String,
) {
    private val scripts = ConcurrentHashMap<String, ScriptEntry>()

    private data class ScriptEntry(val url: URL, val parsedScript: ParsedScript)

    fun register(scriptUrl: URL): String {
        val parsedScript = scriptEvaluator.parse(scriptUrl)
        val hotReloadable = scriptingProperties.hotReload.enabled && scriptUrl.protocol == "file"
        val hotReloadableLabel = if (hotReloadable) "hot-reloadable " else ""

        logger().debug("Registering {} as {}{}", parsedScript.scriptFileName, hotReloadableLabel, scriptTypeDescription)

        scripts[parsedScript.scriptIdentifier] = ScriptEntry(scriptUrl, parsedScript)

        logger().info("Registered {}: {}", scriptTypeDescription, parsedScript.scriptIdentifier)

        return parsedScript.scriptIdentifier
    }

    fun get(name: String): ParsedScript? = resolveScript(name)

    private fun resolveScript(name: String): ParsedScript? {
        val entry = scripts[name] ?: return null
        val hotReloadable = scriptingProperties.hotReload.enabled && entry.url.protocol == "file"
        if (!hotReloadable) {
            return entry.parsedScript
        }

        return synchronized(name.intern()) {
            if (isCacheStale(name)) reloadScript(name) else scripts.getValue(name).parsedScript
        }
    }

    private fun isCacheStale(name: String): Boolean {
        val entry = scripts[name] ?: return true
        return entry.parsedScript.lastParsed.toEpochMilliseconds() < File(entry.url.toURI()).lastModified()
    }

    private fun reloadScript(name: String): ParsedScript {
        val entry = scripts.getValue(name)
        val scriptFileName = entry.parsedScript.scriptFileName
        return try {
            logger().info("Hot-reloading {}: {}", scriptTypeDescription, scriptFileName)
            scriptEvaluator.parse(entry.url).also { scripts[name] = ScriptEntry(entry.url, it) }
        } catch (e: Exception) {
            logger().warn("Failed to hot-reload {} '{}', using cached version: {}", scriptTypeDescription, scriptFileName, e.message)
            scripts.getValue(name).parsedScript
        }
    }
}
