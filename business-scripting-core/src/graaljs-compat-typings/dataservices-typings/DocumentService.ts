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

import { DocumentV2 } from '../kernel-typings/index.js';
import { Locale, JavaOptional } from '../java-util-typings/index.js';

import { DocumentReference } from './DocumentReference.js';
import { DataServicesDocument } from './DataServicesDocument.js';
import { JavaDocumentPart } from './DocumentPart.js';

/**
 * Opaque type for a DocumentValidationStrategy enum instance.
 * @see com.mgmtp.a12.dataservices.document.persistence.DocumentValidationStrategy
 */
export type DocumentValidationStrategy = object;

/**
 * Java class proxy for DocumentValidationStrategy enum, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.document.persistence.DocumentValidationStrategy
 */
export interface DocumentValidationStrategyJavaClass {
    readonly FULL_VALIDATION: DocumentValidationStrategy;
    readonly PARTIAL_VALIDATION: DocumentValidationStrategy;
    readonly NO_VALIDATION: DocumentValidationStrategy;
    readonly DEFAULT_CONFIGURATION: DocumentValidationStrategy;
}

/**
 * Opaque type for a DocumentComputationStrategy enum instance.
 * @see com.mgmtp.a12.dataservices.document.persistence.DocumentComputationStrategy
 */
export type DocumentComputationStrategy = object;

/**
 * Java class proxy for DocumentComputationStrategy enum, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.document.persistence.DocumentComputationStrategy
 */
export interface DocumentComputationStrategyJavaClass {
    readonly FULL_COMPUTATION: DocumentComputationStrategy;
    readonly NO_COMPUTATION: DocumentComputationStrategy;
    readonly DEFAULT_CONFIGURATION: DocumentComputationStrategy;
}

export interface DocumentService {
    'create(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale)'(
        documentV2: DocumentV2,
        locale: Locale | null,
    ): DataServicesDocument;

    'create(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale,com.mgmtp.a12.dataservices.document.persistence.DocumentValidationStrategy,com.mgmtp.a12.dataservices.document.persistence.DocumentComputationStrategy)'(
        documentV2: DocumentV2,
        locale: Locale | null,
        validationStrategy: DocumentValidationStrategy,
        computationStrategy: DocumentComputationStrategy,
    ): DataServicesDocument;

    'update(com.mgmtp.a12.dataservices.document.DocumentReference,com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale)'(
        documentReference: DocumentReference,
        newDocument: DocumentV2,
        locale: Locale | null,
    ): DataServicesDocument;

    'update(com.mgmtp.a12.dataservices.document.DocumentReference,com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.util.Locale,com.mgmtp.a12.dataservices.document.persistence.DocumentValidationStrategy,com.mgmtp.a12.dataservices.document.persistence.DocumentComputationStrategy)'(
        documentReference: DocumentReference,
        newDocument: DocumentV2,
        locale: Locale | null,
        validationStrategy: DocumentValidationStrategy,
        computationStrategy: DocumentComputationStrategy,
    ): DataServicesDocument;

    'update(com.mgmtp.a12.dataservices.document.DocumentReference,java.util.List,java.util.Locale)'(
        documentReference: DocumentReference,
        documentParts: JavaDocumentPart[],
        locale: Locale | null,
    ): DataServicesDocument;

    'update(com.mgmtp.a12.dataservices.document.DocumentReference,java.util.List,java.util.Locale,com.mgmtp.a12.dataservices.document.persistence.DocumentValidationStrategy,com.mgmtp.a12.dataservices.document.persistence.DocumentComputationStrategy)'(
        documentReference: DocumentReference,
        documentParts: JavaDocumentPart[],
        locale: Locale | null,
        validationStrategy: DocumentValidationStrategy,
        computationStrategy: DocumentComputationStrategy,
    ): DataServicesDocument;

    'load(com.mgmtp.a12.dataservices.document.DocumentReference)'(
        documentReference: DocumentReference,
    ): JavaOptional<DataServicesDocument>;

    'delete(com.mgmtp.a12.dataservices.document.DocumentReference)'(documentReference: DocumentReference): void;

    'deleteAll(java.util.Collection)'(documentReferences: DocumentReference[]): void;
}
