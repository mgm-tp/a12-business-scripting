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

import com.mgmtp.a12.scripting.shared.internal.functions.logger
import org.graalvm.polyglot.Value

/**
 * All registered [ScriptTypeMapping]s, addressed by the JVM type they produce.
 *
 * A type that nests another script type reads its nested fields through this, so its parser states which
 * type a field holds and Business Scripting converts it with the mapping registered for that type — the
 * project needs no access to the nested type's parser, which makes types it does not own nestable too.
 *
 * @param registeredMappings supplies the mappings, and is asked again on every lookup until
 *   [indexRegisteredMappings] states that all of them exist — a mapping that nests another one is itself part
 *   of the list and can therefore not be resolved while the list is being built
 */
class ScriptTypeMappings(private val registeredMappings: () -> List<ScriptTypeMapping<*>>) {

    @Volatile
    private var indexedMappings: Map<Class<*>, ScriptTypeMapping<*>>? = null

    /**
     * Indexes the registered mappings for good. Called once every mapping exists, so that a lookup running
     * before that — from a bean that converts a value while the application is still starting — reads the
     * mappings registered so far instead of turning them into the permanent answer.
     */
    fun indexRegisteredMappings() {
        indexedMappings = indexByTargetType(registeredMappings())
    }

    /** Reads a field holding a list of [elementType] from a value the script returned. */
    fun <T : Any> listFieldOrNull(value: Value, fieldName: String, elementType: Class<T>): List<T>? = value.listFieldOrNull(fieldName, mappingFor(elementType, fieldName)::parseOutputOrNull)

    /** Reads a field holding a list of [elementType] from a value the execution context delivered. */
    fun <T : Any> listFieldOrNull(raw: Map<*, *>, fieldName: String, elementType: Class<T>): List<T>? = raw.listFieldOrNull(fieldName, mappingFor(elementType, fieldName)::parseInputOrNull)

    /** Reads a field holding a single [fieldType] from a value the script returned. */
    fun <T : Any> fieldOrNull(value: Value, fieldName: String, fieldType: Class<T>): T? = value.memberOrNull(fieldName)?.let(mappingFor(fieldType, fieldName)::parseOutputOrNull)

    /** Reads a field holding a single [fieldType] from a value the execution context delivered. */
    fun <T : Any> fieldOrNull(raw: Map<*, *>, fieldName: String, fieldType: Class<T>): T? = raw[fieldName]?.let(mappingFor(fieldType, fieldName)::parseInputOrNull)

    private fun mappingsByTargetType(): Map<Class<*>, ScriptTypeMapping<*>> = indexedMappings ?: indexByTargetType(registeredMappings())

    @Suppress("UNCHECKED_CAST")
    private fun <T : Any> mappingFor(targetType: Class<T>, fieldName: String): ScriptTypeMapping<T> {
        val mapping = mappingsByTargetType()[targetType]
        if (mapping == null) {
            // The type is named in the log only: the message reaches the workflow or the RPC caller
            logger().error("No script type mapping is registered for '{}', required by field '{}'", targetType.name, fieldName)
            throw IllegalStateException("[ScriptTypeMappings] No script type mapping is registered for the type of field '$fieldName'")
        }
        return mapping as ScriptTypeMapping<T>
    }

    private fun indexByTargetType(mappings: List<ScriptTypeMapping<*>>): Map<Class<*>, ScriptTypeMapping<*>> {
        val (firstPerTargetType, shadowed) = mappings
            .groupBy(ScriptTypeMapping<*>::targetType)
            .let { grouped -> grouped.mapValues { (_, sameTarget) -> sameTarget.first() } to grouped.filterValues { it.size > 1 } }
        shadowed.forEach { (targetType, sameTarget) ->
            logger().warn(
                "{} script type mappings produce '{}', so only '{}' is used for nested fields of that type",
                sameTarget.size,
                targetType.name,
                sameTarget.first().typeName,
            )
        }
        return firstPerTargetType
    }
}
