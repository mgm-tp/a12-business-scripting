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

import { describe, it, expect } from 'vitest';

import { getDefaultRepetitionsIfEmpty, isFieldInstanceV2, isDocumentV2 } from '../internal/helpers.js';

describe('getDefaultRepetitionsIfEmpty', () => {
	it.each([
		['single-level path', '/foo', undefined, [1]],
		['two-level path', '/foo/bar', undefined, [1, 1]],
		['trailing slash ignored', '/foo/bar/', undefined, [1, 1]],
		['empty path', '', undefined, []],
	])('creates default repetitions for %s', (_, path, reps, expected) => {
		expect(getDefaultRepetitionsIfEmpty(path, reps)).toEqual(expected);
	});

	it('returns existing repetitions unchanged when provided', () => {
		const reps = [1, 2, 1];
		expect(getDefaultRepetitionsIfEmpty('/foo/bar/baz', reps)).toBe(reps);
	});
});

describe('isFieldInstance', () => {
	it('returns true for object with all required methods', () => {
		const fieldInstance = {
			value: () => 'value',
			withValue: () => fieldInstance,
			equals: () => true,
			ofValue: () => fieldInstance,
		};
		expect(isFieldInstanceV2(fieldInstance)).toBe(true);
	});

	it('returns false for null', () => {
		expect(isFieldInstanceV2(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isFieldInstanceV2(undefined)).toBe(false);
	});

	it('returns false for plain object without methods', () => {
		expect(isFieldInstanceV2({ path: '/test', value: 'x' })).toBe(false);
	});

	it('returns false for object with only some methods', () => {
		expect(isFieldInstanceV2({ getPath: () => '/test' })).toBe(false);
		expect(isFieldInstanceV2({ getPath: () => '/test', getValue: () => 'x' })).toBe(false);
	});
});

describe('isDocumentV2', () => {
	it('returns true for object with all required DocumentV2 methods', () => {
		const doc = {
			empty: () => doc,
			ofRootRootGroup: () => doc,
			getId: () => null,
			withId: () => doc,
			getDocumentModelId: () => '',
			toRootRootGroup: () => doc,
		};
		expect(isDocumentV2(doc)).toBe(true);
	});

	it('returns false for null', () => {
		expect(isDocumentV2(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isDocumentV2(undefined)).toBe(false);
	});

	it('returns false for plain object without method', () => {
		expect(isDocumentV2({ entityInstances: [] })).toBe(false);
	});
});
