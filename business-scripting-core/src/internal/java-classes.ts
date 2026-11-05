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

/*
 * Every Java class the scripting API looks up, one accessor each.
 *
 * `ScriptAccessibleJavaClasses` in `business-scripting-shared-script-processing` decides which of these a
 * script may actually resolve. Adding an accessor here means adding its class name there too — nothing
 * checks that yet, so a missing entry surfaces as a denied lookup at runtime.
 *
 * Not reachable from outside the package: scripts reach these classes through the scripting API, never
 * through this module.
 */

import {
    AndOperatorJavaClass,
    DateRangeOperatorJavaClass,
    DocumentDeserializationConfigJavaClass,
    DocumentPartJavaClass,
    DocumentSerializationConfigJavaClass,
    DocumentReferenceJavaClass,
    DocumentV2,
    DoubleRangeOperatorJavaClass,
    ExactMatchOperatorJavaClass,
    InstantJavaClass,
    Java,
    LinkDescriptorJavaClass,
    LocaleJavaClass,
    NotOperatorJavaClass,
    OrOperatorJavaClass,
    PagingJavaClass,
    QueryLinkJavaClass,
    QueryRootJavaClass,
    RelationshipRoleSpecJavaClass,
    SimpleSearchOperatorJavaClass,
    StringReaderJavaClass,
    StringWriterJavaClass,
    UuidJavaClass,
} from '../graaljs-compat-typings/index.js';

export const getQueryRootJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.topology.QueryRoot') as QueryRootJavaClass;
export const getPagingJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.Paging') as PagingJavaClass;
export const getQueryLinkJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.topology.QueryLink') as QueryLinkJavaClass;
export const getExactMatchOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator') as ExactMatchOperatorJavaClass;
export const getDoubleRangeOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.range.DoubleRangeOperator') as DoubleRangeOperatorJavaClass;
export const getDateRangeOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.range.DateRangeOperator') as DateRangeOperatorJavaClass;
export const getSimpleSearchOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.matching.SimpleSearchOperator') as SimpleSearchOperatorJavaClass;
export const getAndOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.logical.AndOperator') as AndOperatorJavaClass;
export const getOrOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.logical.OrOperator') as OrOperatorJavaClass;
export const getNotOperatorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.query.constraint.logical.NotOperator') as NotOperatorJavaClass;
export const getStringReaderJavaClass = () => Java.type('java.io.StringReader') as StringReaderJavaClass;
export const getDocumentDeserializationConfigJavaClass = () => Java.type('com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig') as DocumentDeserializationConfigJavaClass;
export const getDocumentSerializationConfigJavaClass = () => Java.type('com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig') as DocumentSerializationConfigJavaClass;
export const getLocaleJavaClass = () => Java.type('java.util.Locale') as LocaleJavaClass;
export const getDocumentReferenceJavaClass = () => Java.type('com.mgmtp.a12.dataservices.document.DocumentReference') as DocumentReferenceJavaClass;
export const getDocumentV2JavaClass = () => Java.type('com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2') as typeof DocumentV2;
export const getDocumentPartJavaClass = () => Java.type('com.mgmtp.a12.dataservices.document.DocumentPart') as DocumentPartJavaClass;
export const getStringWriterJavaClass = () => Java.type('java.io.StringWriter') as StringWriterJavaClass;
export const getUuidJavaClass = () => Java.type('java.util.UUID') as UuidJavaClass;
export const getInstantJavaClass = () => Java.type('java.time.Instant') as InstantJavaClass;
export const getLinkDescriptorJavaClass = () => Java.type('com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor') as LinkDescriptorJavaClass;
export const getRelationshipRoleSpecJavaClass = () => Java.type('com.mgmtp.a12.dataservices.relationship.spec.RelationshipRoleSpec') as RelationshipRoleSpecJavaClass;
