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

import { DocumentReference } from './document-reference.js';

export type FieldPath = string;
export type ElementPath = string;
export type FieldValue = unknown;

/**
 * Represents a document field with its path, value, and position in repeatable groups.
 * @public
 */
export type FieldSpec = {
	/** Path to the field (e.g. "/Person/Name"). */
	path: FieldPath;
	/** The field value. */
	value: FieldValue;
	/** Position in repeatable groups (1-indexed). If omitted, defaults to [1,1,...] based on path depth. */
	repetitions?: number[];
};
export type DocumentModelName = string;

/**
 * A constraint tree for the QUERY operation. Each node carries a string discriminator
 * matching the DataServices operator name; Kotlin / DS-runtime translate the tree
 * into the corresponding operator class.
 *
 * Build constraints via `A12.Documents.Filter` helpers — do not construct by hand.
 * @see com.mgmtp.a12.dataservices.query.constraint (operator classes)
 */
export type Constraint =
    | { operator: 'exact_match'; field: string; value: string | number | boolean }
    | { operator: 'numeric_range'; field: string; from?: number; to?: number }
    | { operator: 'date_range'; field: string; from?: string; to?: string }
    | { operator: 'simple_search'; value: string; fields?: string[] }
    | { operator: 'and'; operands: [Constraint, Constraint, ...Constraint[]] }
    | { operator: 'or'; operands: [Constraint, Constraint, ...Constraint[]] }
    | { operator: 'not'; operand: Constraint };
export type RelationshipModelName = string;
export type Role = string;
export type RelationshipLinkSpec = {
	id: LinkId;
	linkDescriptor: RelationshipLinkDescriptor;
	linkDocRef?: DocumentReference;
};
export type RelationshipLinkDescriptor = {
	relationshipModelName: RelationshipModelName;
	sourceRole: Role;
	sourceDocRef: DocumentReference;
	targetRole: Role;
	targetDocRef: DocumentReference;
};
export type LinkId = string;
