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
 * Field readers for the two value shapes a [ScriptTypeMapping] parser meets: a [Value] the script
 * returned and a [Map] the execution context delivered.
 *
 * Each reader returns `null` where the field is missing, null or not of the requested type, so a
 * parser rejects an unusable value by a single elvis instead of by a failing cast further down.
 */

fun Value.stringFieldOrNull(fieldName: String): String? = memberOrNull(fieldName)?.takeIf(Value::isString)?.asString()

/** Accepts every whole number the script can represent as an int, and rejects a fractional one. */
fun Value.intFieldOrNull(fieldName: String): Int? = memberOrNull(fieldName)?.takeIf(Value::fitsInInt)?.asInt()

/** Accepts every whole number the script can represent as a long, and rejects a fractional one. */
fun Value.longFieldOrNull(fieldName: String): Long? = memberOrNull(fieldName)?.takeIf(Value::fitsInLong)?.asLong()

fun Value.doubleFieldOrNull(fieldName: String): Double? = memberOrNull(fieldName)?.takeIf(Value::fitsInDouble)?.asDouble()

fun Value.booleanFieldOrNull(fieldName: String): Boolean? = memberOrNull(fieldName)?.takeIf(Value::isBoolean)?.asBoolean()

/**
 * Reads a list field, parsing every element with [parseElement], and rejects the whole field as soon as one
 * element does not parse. A parser for a type that nests another type passes the nested type's parser in.
 */
fun <T : Any> Value.listFieldOrNull(fieldName: String, parseElement: (Value) -> T?): List<T>? {
    val elements = memberOrNull(fieldName)?.takeIf(Value::hasArrayElements) ?: return null
    return (0 until elements.arraySize).map { index -> parseElement(elements.getArrayElement(index)) ?: return null }
}

/**
 * Unwraps a value the script did not build itself but received as an input and passed on, back to [targetType].
 *
 * [ScriptTypeMapping.parseOutputOrNull] applies this to every value it parses, so a parser needs it only where
 * it inspects a value no mapping was asked for.
 */
fun <T : Any> Value.hostObjectOrNull(targetType: Class<T>): T? = if (isHostObject) asHostObject<Any>().takeIf(targetType::isInstance)?.let(targetType::cast) else null

/** [Value.getMember] throws for a value that has no fields at all, so such a value is rejected first. */
internal fun Value.memberOrNull(fieldName: String): Value? = if (hasMembers()) getMember(fieldName) else null

fun Map<*, *>.stringFieldOrNull(fieldName: String): String? = this[fieldName] as? String

/** Workflow variables and deserialized JSON deliver whole numbers as Integer, Long or Double alike. */
fun Map<*, *>.intFieldOrNull(fieldName: String): Int? = (this[fieldName] as? Number)?.toIntOrNullWithoutLoss()

/** Workflow variables and deserialized JSON deliver whole numbers as Integer, Long or Double alike. */
fun Map<*, *>.longFieldOrNull(fieldName: String): Long? = (this[fieldName] as? Number)?.toLongOrNullWithoutLoss()

fun Map<*, *>.doubleFieldOrNull(fieldName: String): Double? = (this[fieldName] as? Number)?.toDouble()

fun Map<*, *>.booleanFieldOrNull(fieldName: String): Boolean? = this[fieldName] as? Boolean

/**
 * Reads a list field, parsing every element with [parseElement], and rejects the whole field as soon as one
 * element does not parse. A parser for a type that nests another type passes the nested type's parser in.
 */
fun <T : Any> Map<*, *>.listFieldOrNull(fieldName: String, parseElement: (Any) -> T?): List<T>? {
    val elements = this[fieldName] as? List<*> ?: return null
    return elements.map { element -> element?.let(parseElement) ?: return null }
}

private fun Number.toIntOrNullWithoutLoss(): Int? = toInt().takeIf { it.toDouble() == toDouble() }

private fun Number.toLongOrNullWithoutLoss(): Long? = toLong().takeIf { it.toDouble() == toDouble() }
