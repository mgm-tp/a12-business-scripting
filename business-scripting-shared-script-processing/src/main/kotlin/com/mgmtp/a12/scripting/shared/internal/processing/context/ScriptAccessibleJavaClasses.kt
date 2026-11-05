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

/**
 * The Java classes a script may look up, and the lookup predicate of every context this product builds.
 *
 * [classNames] holds exactly the names `business-scripting-core/src/internal/java-classes.ts` passes to
 * `Java.type`. `java-classes.ts` is the list to keep this one in step with. A name added there and not
 * here breaks that part of the API at runtime, with no compile-time signal and no test that catches it.
 * The runtime failure is loud and diagnosable — the lookup is denied and the rejected class name
 * reaches the server-side log.
 */
object ScriptAccessibleJavaClasses {

    val classNames: Set<String> = setOf(
        "com.mgmtp.a12.dataservices.document.DocumentPart",
        "com.mgmtp.a12.dataservices.document.DocumentReference",
        "com.mgmtp.a12.dataservices.query.Paging",
        "com.mgmtp.a12.dataservices.query.constraint.logical.AndOperator",
        "com.mgmtp.a12.dataservices.query.constraint.logical.NotOperator",
        "com.mgmtp.a12.dataservices.query.constraint.logical.OrOperator",
        "com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator",
        "com.mgmtp.a12.dataservices.query.constraint.matching.SimpleSearchOperator",
        "com.mgmtp.a12.dataservices.query.constraint.range.DateRangeOperator",
        "com.mgmtp.a12.dataservices.query.constraint.range.DoubleRangeOperator",
        "com.mgmtp.a12.dataservices.query.topology.QueryLink",
        "com.mgmtp.a12.dataservices.query.topology.QueryRoot",
        "com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor",
        "com.mgmtp.a12.dataservices.relationship.spec.RelationshipRoleSpec",
        "com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig",
        "com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig",
        "com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2",
        "java.io.StringReader",
        "java.io.StringWriter",
        "java.time.Instant",
        "java.util.Locale",
        "java.util.UUID",
    )

    fun isAccessible(className: String): Boolean = className in classNames
}
