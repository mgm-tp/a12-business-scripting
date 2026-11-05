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

package com.mgmtp.a12.scripting.rpcFacade.internal.query

import com.mgmtp.a12.dataservices.query.constraint.ILogicOperator
import com.mgmtp.a12.dataservices.query.constraint.logical.AndOperator
import com.mgmtp.a12.dataservices.query.constraint.logical.NotOperator
import com.mgmtp.a12.dataservices.query.constraint.logical.OrOperator
import com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator
import com.mgmtp.a12.dataservices.query.constraint.matching.SimpleSearchOperator
import com.mgmtp.a12.dataservices.query.constraint.range.DoubleRangeOperator

/**
 * Converts a GraalJS constraint map (matching the TypeScript Constraint discriminated union)
 * into the corresponding DataServices Java constraint operator.
 */
@Suppress("UNCHECKED_CAST")
fun buildConstraintOperator(constraint: Map<String, Any>): ILogicOperator = when (val operator = constraint["operator"] as String) {
    "exact_match" ->
        ExactMatchOperator
            .builder<Any>()
            .field(constraint["field"] as String)
            .value(constraint["value"]!!)
            .build()
    "numeric_range" -> {
        var builder = DoubleRangeOperator.builder().field(constraint["field"] as String)
        (constraint["from"] as? Number)?.let { builder = builder.from(it.toDouble()) }
        (constraint["to"] as? Number)?.let { builder = builder.to(it.toDouble()) }
        builder.build()
    }
    "simple_search" -> {
        var builder = SimpleSearchOperator.builder().value(constraint["value"] as String)
        (constraint["fields"] as? List<String>)?.let { builder = builder.fields(it) }
        builder.build()
    }
    "and" -> AndOperator.builder().operands(buildOperandList(constraint)).build()
    "or" -> OrOperator.builder().operands(buildOperandList(constraint)).build()
    "not" ->
        NotOperator
            .builder()
            .operand(buildConstraintOperator(constraint["operand"] as Map<String, Any>))
            .build()
    else -> throw IllegalArgumentException("Unknown constraint operator: $operator")
}

@Suppress("UNCHECKED_CAST")
private fun buildOperandList(constraint: Map<String, Any>): List<ILogicOperator> = (constraint["operands"] as List<Map<String, Any>>).map { buildConstraintOperator(it) }
