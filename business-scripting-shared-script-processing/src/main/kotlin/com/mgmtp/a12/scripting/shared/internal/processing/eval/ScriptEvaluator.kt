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

import com.mgmtp.a12.scripting.shared.internal.functions.toCamelCase
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import org.graalvm.polyglot.Source
import org.graalvm.polyglot.Value
import java.net.URL
import kotlin.io.path.toPath
import kotlin.time.Clock

class ScriptEvaluator(
    private val jsContextFactory: JsContextFactory,
    private val scriptTypeValidator: ScriptTypeValidator,
) {

    fun parse(scriptUrl: URL): ParsedScript {
        val scriptFile = scriptUrl.toURI().toPath()
        // The file name alone, so no absolute path can reach an error message through the script identity
        val scriptFileName = scriptFile.fileName.toString()
        val source = Source
            .newBuilder("js", scriptFile.toFile())
            .mimeType("application/javascript+module")
            .build()
        val currentWorkingDirectory = scriptFile.parent
        return jsContextFactory.createContext(currentWorkingDirectory).use { tempCtx ->
            val scriptFn = tempCtx.evalEntryFunction(source, scriptFileName)
            val params = scriptFn.getMemberOrEmptyMap("__paramTypes")
            val returnProperties = scriptFn.getMemberOrEmptyMap("__returnProperties")
            scriptTypeValidator.validateScriptInputTypings(params)
            scriptTypeValidator.validateScriptOutputTypings(returnProperties)
            ParsedScript(
                source = source,
                scriptFileName = scriptFileName,
                scriptIdentifier = toCamelCase(scriptFileName.replace(".js", "")),
                params = params,
                returnProperties = returnProperties,
                lastParsed = Clock.System.now(),
                currentWorkingDirectory = currentWorkingDirectory,
            )
        }
    }

    // Eagerly copies entries so the result remains usable after the surrounding Context is closed —
    // a PolyglotMap is bound to its Context and throws once the Context is closed.
    private fun Value.getMemberOrEmptyMap(memberName: String): Map<String, String> = try {
        val polyglotMap = this.getMember(memberName).`as`(Map::class.java) as Map<String, String>
        LinkedHashMap(polyglotMap)
    } catch (_: NullPointerException) {
        emptyMap()
    }
}
