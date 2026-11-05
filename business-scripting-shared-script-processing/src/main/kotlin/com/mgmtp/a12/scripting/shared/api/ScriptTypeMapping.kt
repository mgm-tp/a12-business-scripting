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

package com.mgmtp.a12.scripting.shared.api

import org.graalvm.polyglot.Value

/**
 * Bridges a JVM type and its script representation for one script type name.
 *
 * Each direction is declared as one parser that returns `null` for a value it does not accept.
 * Deciding and converting therefore share a single implementation and cannot disagree, and a
 * rejected value is reported by its script type name rather than by a conversion error from
 * somewhere deeper down.
 *
 * A mapping may cover one direction only; converting in the other one is then unsupported.
 *
 * Parsers must be free of side effects: the same value may be parsed more than once.
 *
 * @param T the JVM type this mapping produces
 * @param typeName the type name scripts declare in their `Inputs` and `Outputs` interfaces
 * @param targetType the JVM class of [T]
 * @param parseInput builds [T] from a value entering the script — a workflow variable, an RPC
 *   argument or an instance of [T] itself — or returns `null` to reject it
 * @param parseOutput builds [T] from a value the script returned, or returns `null` to reject it.
 *   GraalVM unwraps host objects of [targetType] on its own, so this parser sees the values the
 *   script itself created.
 */
class ScriptTypeMapping<T : Any>(
    val typeName: String,
    val targetType: Class<T>,
    private val parseInput: ((Any) -> T?)? = null,
    private val parseOutput: ((Value) -> T?)? = null,
) {
    val supportsInput: Boolean get() = parseInput != null
    val supportsOutput: Boolean get() = parseOutput != null

    /**
     * Parses a value this mapping's type is nested in, and returns `null` where it does not accept it.
     * [ScriptTypeMappings] converts the fields of a nesting type through this.
     */
    fun parseInputOrNull(raw: Any): T? = parseInput?.invoke(raw)

    /**
     * Parses a value this mapping's type is nested in, and returns `null` where it does not accept it.
     *
     * A value the script received as an input and passed on is returned as it is: GraalVM unwraps such a
     * host object only where it converts the script result itself, which is not the case inside a nesting type.
     */
    fun parseOutputOrNull(value: Value): T? {
        val parse = parseOutput ?: return null
        return value.hostObjectOrNull(targetType) ?: parse(value)
    }

    fun acceptsInput(raw: Any): Boolean = parseInputOrNull(raw) != null

    fun acceptsOutput(value: Value): Boolean = parseOutputOrNull(value) != null

    fun convertInput(raw: Any): T {
        if (!supportsInput) throw UnsupportedOperationException("[ScriptTypeMapping] Type '$typeName' has no input mapping")
        // The value belongs to the caller and stays out of the message
        return parseInputOrNull(raw) ?: throw IllegalArgumentException("[ScriptTypeMapping] The given value is not valid for type '$typeName'")
    }

    fun convertOutput(value: Value): T {
        if (!supportsOutput) throw UnsupportedOperationException("[ScriptTypeMapping] Type '$typeName' has no output mapping")
        return parseOutputOrNull(value) ?: throw IllegalArgumentException("[ScriptTypeMapping] The script result is not valid for type '$typeName'")
    }
}
