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

import { FieldPath, FieldSpec, FieldValue } from '../api/types.js';
import { DocumentV2, FieldInstanceV2 } from '../graaljs-compat-typings/index.js';

// =============================================================================
// Type Guards
// =============================================================================

/** Type guard: checks if an object is an FieldInstanceV2 */
export function isFieldInstanceV2(obj: unknown): obj is FieldInstanceV2 {
	return typeof obj === 'object' && obj !== null
        && 'value' in obj && 'withValue' in obj && 'equals' in obj && 'ofValue' in obj
        ;
}

/** Type guard: checks if an object is an DocumentV2 */
export function isDocumentV2(obj: unknown): obj is DocumentV2 {
	return typeof obj === 'object' && obj !== null
        && 'getId' in obj && typeof obj.getId === 'function'
        && 'withId' in obj && typeof obj.withId === 'function'
        && 'getDocumentModelId' in obj && typeof obj.getDocumentModelId === 'function'
        && 'toRootRootGroup' in obj && typeof obj.toRootRootGroup === 'function';
}

// =============================================================================
// Field Input Types
// =============================================================================

/** New unified input format for writeFields. */
export type FieldInput = { field: FieldPath; value: FieldValue; repetitions?: number[]; append?: boolean };

/** Input type for writeFields - either new format with `field` or FieldSpec with `path`. */
export type WriteFieldInput = FieldInput | (FieldSpec & { append?: boolean });

/** Type guard: checks if input uses FieldSpec format (has 'path'). */
export function hasPath(input: WriteFieldInput): input is FieldSpec & { append?: boolean } {
	return 'path' in input;
}

// =============================================================================
// Array & Repetition Utils
// =============================================================================

/** Creates default repetitions [1,1,...] based on path depth, or returns existing */
export function getDefaultRepetitionsIfEmpty(path: string, repetitions?: number[]): number[] {
	return repetitions ?? Array(path.split('/').filter(Boolean).length).fill(1);
}

/** Checks if two number arrays are equal */
export function arraysEqual(a?: number[], b?: number[]): boolean {
	if (!a || !b) {
		return a === b;
	}
	if (a.length !== b.length) {
		return false;
	}
	return a.every((v, i) => v === b[i]);
}

/** Checks if array starts with given prefix */
export function repetitionsStartWith(arr: number[], prefix: number[]): boolean {
	if (prefix.length > arr.length) {
		return false;
	}
	return prefix.every((val, idx) => arr[idx] === val);
}
