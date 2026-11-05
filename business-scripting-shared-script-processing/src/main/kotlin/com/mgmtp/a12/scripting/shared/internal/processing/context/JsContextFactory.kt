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

package com.mgmtp.a12.scripting.shared.internal.processing.context

import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.EnvironmentAccess
import org.graalvm.polyglot.HostAccess
import org.graalvm.polyglot.PolyglotAccess
import org.graalvm.polyglot.Value
import org.graalvm.polyglot.io.IOAccess
import java.nio.file.Path

class JsContextFactory(
    private val engine: Engine,
    scriptTypeMappings: List<ScriptTypeMapping<*>>,
    private val ioAccessProvider: ScriptLocationIoAccessProvider,
) {
    private val hostAccess: HostAccess = buildHostAccess(scriptTypeMappings)

    // A fresh builder per call: Context.Builder is not thread-safe and script invocations are concurrent.
    // The Engine and the HostAccess stay shared — both are immutable, and the Engine carries the JIT/AST cache.
    private fun jsContextBuilder() = Context
        .newBuilder()
        .engine(engine)
        .allowHostAccess(hostAccess)
        .allowHostClassLookup(ScriptAccessibleJavaClasses::isAccessible)
        // Explicitness, not mitigation: these are already the defaults, and host interop reaches the underlying
        // capabilities regardless of all five. Neither they nor the lookup predicate confine a script; the
        // predicate bounds which classes a script may name, which is a support boundary, not a sandbox.
        .allowCreateProcess(false)
        .allowNativeAccess(false)
        .allowCreateThread(false)
        .allowEnvironmentAccess(EnvironmentAccess.NONE)
        .allowPolyglotAccess(PolyglotAccess.NONE)
        .option("js.esm-eval-returns-exports", "true")
        .option("js.print", "true")
        .option("js.unhandled-rejections", "throw")
        .err(System.err)
        .out(System.out)

    /**
     * Creates a context for a script lying in [currentWorkingDirectory], which is both the base for the script's
     * relative imports and the key selecting its file access. A context created without a script directory has no
     * directory to read from and therefore gets no file access at all.
     */
    fun createContext(currentWorkingDirectory: Path? = null): Context {
        val scriptDirectory = currentWorkingDirectory ?: return contextWithoutFileAccess()
        val ioAccess = ioAccessProvider.ioAccessForScriptDirectory(scriptDirectory)
        return jsContextBuilder().allowIO(ioAccess).currentWorkingDirectory(scriptDirectory).build()
    }

    private fun contextWithoutFileAccess(): Context = jsContextBuilder().allowIO(IOAccess.NONE).build()
}

private fun buildHostAccess(scriptTypeMappings: List<ScriptTypeMapping<*>>): HostAccess {
    val outputMappings = scriptTypeMappings.filter { it.supportsOutput }
    return HostAccess
        .newBuilder(HostAccess.ALL)
        .apply { outputMappings.forEach { registerOutputMapping(it) } }
        .build()
}

@Suppress("UNCHECKED_CAST")
private fun HostAccess.Builder.registerOutputMapping(mapping: ScriptTypeMapping<*>) {
    val typedMapping = mapping as ScriptTypeMapping<Any>
    targetTypeMapping(
        Value::class.java,
        typedMapping.targetType,
        { v -> typedMapping.acceptsOutput(v) },
        { v -> typedMapping.convertOutput(v) },
        HostAccess.TargetMappingPrecedence.LOW,
    )
}
