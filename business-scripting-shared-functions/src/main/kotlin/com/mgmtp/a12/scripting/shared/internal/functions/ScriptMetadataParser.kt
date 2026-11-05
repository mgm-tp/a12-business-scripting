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

package com.mgmtp.a12.scripting.shared.internal.functions

/**
 * Pure text-parsing utilities for extracting metadata from bundled business script text.
 * Metadata properties are injected by the build pipeline (scripts/esbuild.build.js).
 */
object ScriptMetadataParser {

    /**
     * Metadata property names injected by the build pipeline (scripts/esbuild.build.js).
     * Changes here must be reflected in bun.build.js and vice versa.
     */
    const val PARAM_TYPES_PROPERTY = "__paramTypes"
    const val RETURN_PROPERTIES_PROPERTY = "__returnProperties"

    private val PARAM_TYPES_REGEX = Regex("""(\w+)\.$PARAM_TYPES_PROPERTY\s*=\s*(\{(?:"[^"]*"|[^}])*\})""")
    private val RETURN_PROPERTIES_REGEX = Regex("""(\w+)\.$RETURN_PROPERTIES_PROPERTY\s*=\s*(\{(?:"[^"]*"|[^}])*\})""")
    private val ENTRY_REGEX = Regex(""""(\w+)"\s*:\s*"([^"]*)"""")

    private const val METADATA_BLOCK_GROUP = 2

    /** Extracts param names and types from __paramTypes assignment in the bundle text. */
    fun parseParamTypesFromScript(scriptText: String): Map<String, String> {
        if (PARAM_TYPES_PROPERTY !in scriptText) return emptyMap()
        val match = PARAM_TYPES_REGEX.find(scriptText) ?: return emptyMap()
        return parseMetadataBlock(match.groupValues[METADATA_BLOCK_GROUP])
    }

    /** Extracts return property names and types from __returnProperties assignment in the bundle text. */
    fun parseReturnPropertiesFromScript(scriptText: String): Map<String, String> {
        if (RETURN_PROPERTIES_PROPERTY !in scriptText) return emptyMap()
        val match = RETURN_PROPERTIES_REGEX.find(scriptText) ?: return emptyMap()
        return parseMetadataBlock(match.groupValues[METADATA_BLOCK_GROUP])
    }

    private fun parseMetadataBlock(jsonStr: String): Map<String, String> {
        val result = LinkedHashMap<String, String>()
        for (match in ENTRY_REGEX.findAll(jsonStr)) {
            result[match.groupValues[1]] = match.groupValues[2]
        }
        return result
    }
}
