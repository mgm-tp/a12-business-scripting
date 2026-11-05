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

import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptTypeConstants
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Value

class ScriptTypeConverter(scriptTypeMappings: List<ScriptTypeMapping<*>> = emptyList()) {

    private val inputMappings = scriptTypeMappings.filter { it.supportsInput }.associateBy { it.typeName }
    private val outputMappings = scriptTypeMappings.filter { it.supportsOutput }.associateBy { it.typeName }

    fun convertJavaToJs(raw: Any?, inputType: String, ctx: Context): Any? {
        if (raw == null) return null

        arrayElementType(inputType)?.let { elementType ->
            return when {
                raw is Iterable<*> -> buildJsArray(raw, elementType, ctx)
                raw is String -> ctx.eval("js", "JSON.parse").execute(raw).also {
                    if (!it.hasArrayElements()) {
                        // The string is the caller's own JSON, so name the defect instead of rendering it
                        throw IllegalArgumentException(
                            "Expected a JSON array string for type '$inputType' but the parsed value is not an array",
                        )
                    }
                }
                else -> throw IllegalArgumentException(
                    "Expected list for type '$inputType' but got ${typeNameOf(raw)}",
                )
            }
        }

        inputMappings[inputType]?.let { mapping ->
            if (!mapping.acceptsInput(raw)) {
                throw IllegalArgumentException(
                    "A value of type ${typeNameOf(raw)} is not valid for type '$inputType'",
                )
            }
            return mapping.convertInput(raw)
        }

        when (inputType) {
            "string" -> if (raw !is String) {
                throw IllegalArgumentException(
                    "Expected string but got ${typeNameOf(raw)}",
                )
            }
            "number" -> if (raw !is Number) {
                throw IllegalArgumentException(
                    "Expected number but got ${typeNameOf(raw)}",
                )
            }
            "boolean" -> if (raw !is Boolean) {
                throw IllegalArgumentException(
                    "Expected boolean but got ${typeNameOf(raw)}",
                )
            }
            else -> logger().warn("No input conversion registered for type '{}', passing value through as-is", inputType)
        }

        return raw
    }

    private fun buildJsArray(items: Iterable<*>, elementType: String, ctx: Context): Value {
        val jsArray = ctx.eval("js", "[]")
        items.forEachIndexed { index, element ->
            jsArray.setArrayElement(index.toLong(), convertJavaToJs(element, elementType, ctx))
        }
        return jsArray
    }

    fun convertJsToJava(value: Value, returnType: String): Any? = arrayElementType(returnType)?.let { convertList(value, it) }
        ?: ScriptTypeConstants.SIMPLE_LIST_PATTERN
            .matchEntire(returnType)
            ?.groupValues
            ?.get(1)
            ?.let { convertList(value.getMember("items"), it) }
        ?: when (returnType) {
            "string" -> rejectingInvalidScriptResult(value, returnType, Value::asString)
            "number" -> rejectingInvalidScriptResult(value, returnType, ::asJavaNumber)
            "boolean" -> rejectingInvalidScriptResult(value, returnType, Value::asBoolean)
            else -> outputMappings[returnType]?.let { mapping ->
                rejectingInvalidScriptResult(value, mapping.typeName) { scriptResult -> scriptResult.`as`(mapping.targetType) }
            } ?: run {
                logger().warn("No output conversion registered for type '{}', using raw value", returnType)
                value.`as`(Any::class.java)
            }
        }

    // GraalVM's own conversion failure names JVM classes and quotes the script result, so only debug level carries it
    private fun <T> rejectingInvalidScriptResult(value: Value, returnType: String, convert: (Value) -> T): T = try {
        convert(value)
    } catch (conversionFailure: ClassCastException) {
        logger().debug("Script result could not be converted to type '{}'", returnType, conversionFailure)
        throw IllegalArgumentException(
            "A script result of type ${jsTypeNameOf(value)} is not valid for type '$returnType'",
        )
    }

    private fun asJavaNumber(scriptResult: Value): Number = when {
        scriptResult.fitsInInt() -> scriptResult.asInt()
        scriptResult.fitsInLong() -> scriptResult.asLong()
        else -> scriptResult.asDouble()
    }

    private fun arrayElementType(returnType: String): String? = when {
        returnType.endsWith("[]") -> returnType.dropLast(2)
        else ->
            ScriptTypeConstants.ARRAY_PATTERN
                .matchEntire(returnType)
                ?.groupValues
                ?.get(1)
    }

    // value.as(List::class.java) returns a PolyglotList proxy still bound to the context —
    // iterating eagerly here produces a detached Java list safe to use after context close.
    private fun convertList(arrayValue: Value, elementType: String): List<Any?> = try {
        (0 until arrayValue.arraySize).map { i -> convertJsToJava(arrayValue.getArrayElement(i), elementType) }
    } catch (_: UnsupportedOperationException) {
        throw IllegalArgumentException("Expected array value but got ${jsTypeNameOf(arrayValue)}")
    }

    // Anonymous classes have no simple name, so fall back to the qualified one — the message must name a type.
    private fun typeNameOf(value: Any): String = value::class.simpleName ?: value::class.java.name

    // The JS-visible type, never Value::class.simpleName, which would name an engine-internal class.
    private fun jsTypeNameOf(value: Value): String = value.metaObject?.metaSimpleName ?: "value"
}
