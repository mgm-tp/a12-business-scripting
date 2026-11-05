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

package com.mgmtp.a12.scripting.shared.internal.invoker

import com.mgmtp.a12.scripting.shared.internal.functions.logger
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Value
import java.util.function.Consumer

class ScriptInvoker(private val scriptTypeConverter: ScriptTypeConverter) {

    fun invokeScriptFunction(
        ctx: Context,
        scriptFn: Value,
        params: Map<String, String>,
        returnProperties: Map<String, String>,
        arguments: Map<String, Any?>,
    ): Map<String, Any?> {
        val args = if (params.isNotEmpty()) {
            val inputObj = ctx.eval("js", "({})")
            for ((name, type) in params) {
                if (!arguments.containsKey(name)) {
                    logger().warn("Script parameter '{}' has no matching argument", name)
                }
                inputObj.putMember(name, scriptTypeConverter.convertJavaToJs(arguments[name], type, ctx))
            }
            arrayOf<Any?>(inputObj)
        } else {
            emptyArray()
        }

        val rawResult = scriptFn.execute(*args)
        val result = if (rawResult.hasMember("then")) resolvePromise(ctx, rawResult) else rawResult

        // Must be before isNull check: void scripts may legally return null
        if (returnProperties.isEmpty()) return emptyMap()
        if (result.isNull) {
            throw IllegalStateException(
                "Returning `null` from a business script is not allowed. You can either remove any return, or return an object with a key that contains your `null` value instead.",
            )
        }

        return returnProperties.mapValues { (propName, propType) ->
            val propValue = result.getMember(propName)
            if (propValue == null || propValue.isNull) {
                throw IllegalStateException("Return value '$propName' not found in the script result.")
            }
            scriptTypeConverter.convertJsToJava(propValue, propType)
        }
    }

    private fun resolvePromise(ctx: Context, promise: Value): Value {
        var settled = false
        var resolved: Any? = null
        var rejected: Any? = null

        // Callback function for resolved and rejected paths
        promise.invokeMember(
            "then",
            Consumer<Any?> { v ->
                resolved = v
                settled = true
            },
            Consumer<Any?> { e ->
                rejected = e
                settled = true
            },
        )

        // drain microtask queue so callbacks fire
        ctx.eval("js", "0")

        // We need to check for settled since "undefined" Promise value equal null in Java
        // otherwise we cannot distinguish between an unresolved promise and a Promise with an undefined value
        if (!settled) throw IllegalStateException("Script promise did not resolve synchronously")
        rejected?.let {
            val error = (it as? Value) ?: Value.asValue(it)
            if (error.isException) error.throwException()
            throw RuntimeException(error.toString())
        }
        val value = resolved ?: return ctx.eval("js", "undefined")
        return (value as? Value) ?: Value.asValue(value)
    }
}
