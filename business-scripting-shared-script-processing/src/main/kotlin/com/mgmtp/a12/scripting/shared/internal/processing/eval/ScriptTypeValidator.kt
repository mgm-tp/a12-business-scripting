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

import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping

class ScriptTypeValidator(scriptTypeMappings: List<ScriptTypeMapping<*>> = emptyList()) {
    companion object {
        val PRIMITIVE_TYPES = arrayOf("string", "number", "boolean")
    }

    private val inputMappings = scriptTypeMappings.filter { it.supportsInput }.associateBy { it.typeName }
    private val outputMappings = scriptTypeMappings.filter { it.supportsOutput }.associateBy { it.typeName }

    fun validateScriptTypings(properties: Map<String, String>, mappings: Map<String, ScriptTypeMapping<*>>, description: String) {
        val validationFindings = validateProperties(properties)
        if (validationFindings.isNotEmpty()) {
            // Throw early to avoid having customTypeFindings for forbidden types!
            throw IllegalArgumentException("$description validation failed: $validationFindings")
        }
        val customTypeFindings = validateCustomTypes(properties, mappings)
        if (customTypeFindings.isNotEmpty()) {
            throw IllegalArgumentException("$description validation failed: $customTypeFindings")
        }
    }

    private fun validateProperties(properties: Map<String, String>): String = properties
        .map {
            when {
                it.value.contains("//") ->
                    "Line comment in '${it.key}: ${it.value}' is not allowed!"
                it.value.contains("/*") ->
                    "Block comment in '${it.key}: ${it.value}' is not allowed!"
                it.value.contains("\n") ->
                    "Multiline type '${it.key}: ${it.value}' is not allowed!"
                it.key.endsWith("?") ->
                    "Optional type '${it.key}: ${it.value}' is not allowed!"
                it.value == "undefined" ->
                    "Undefined type '${it.key}: ${it.value}' is not allowed!'"
                it.value.contains("|") ->
                    "Union type '${it.key}: ${it.value}' is not allowed!"
                it.value.matches(Regex("\\{.*\\}")) ->
                    "Nested type '${it.key}: ${it.value}' is not allowed!"
                else -> null
            }
        }.filterNotNull()
        .joinToString(separator = ";")

    private fun validateCustomTypes(properties: Map<String, String>, types: Map<String, ScriptTypeMapping<*>>): String = properties.entries
        .map { entry -> entry to extractInnerTypeFromIterableType(entry.value) }
        .filter { (_, innerType) -> !PRIMITIVE_TYPES.contains(innerType) }
        .filter { (_, innerType) -> !types.containsKey(innerType) }
        .joinToString(separator = ";") { (entry, _) -> "Unknown custom type '${entry.key}: ${entry.value}' is not allowed!" }

    fun validateScriptInputTypings(properties: Map<String, String>) {
        validateScriptTypings(properties, inputMappings, "Script Inputs")
    }

    fun validateScriptOutputTypings(properties: Map<String, String>) {
        validateScriptTypings(properties, outputMappings, "Script Outputs")
    }

    /**
     * Given an iterable type (Array<T>, T[], SimpleList<T>) this method extracts the inner type T
     *
     * For nested iterable types (Array<T[]>,T[][]) this is done repeatedly until T is extracted.
     */
    private fun extractInnerTypeFromIterableType(type: String): String {
        var outerType: String
        var innerType = type
        do {
            outerType = innerType
            if (outerType.endsWith("[]")) {
                innerType = outerType.dropLast(2)
            }
            ScriptTypeConstants.ARRAY_PATTERN.matchEntire(outerType)?.groupValues?.get(1)?.let {
                innerType = it
            }
            ScriptTypeConstants.SIMPLE_LIST_PATTERN.matchEntire(outerType)?.groupValues?.get(1)?.let {
                innerType = it
            }
        } while (outerType != innerType)
        return innerType
    }
}
