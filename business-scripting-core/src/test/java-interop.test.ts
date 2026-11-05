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

import { convertJavaFieldValue, unwrapOptional } from '../internal/java-interop.js';
import { JavaOptional } from '../graaljs-compat-typings/index.js';

const JAN_30_MIDNIGHT_ISO = '2025-01-30T00:00:00Z';
const JAN_30_DATETIME_ISO = '2025-01-30T14:30:00Z';
const JAN_30_DATE = '2025-01-30';
const JAN_30_DATETIME_RESULT = '2025-01-30T14:30:00';
const JUN_15_MIDNIGHT_ISO = '2025-06-15T00:00:00Z';
const JUN_15_DATE = '2025-06-15';
const EPOCH_DATETIME_ISO = '1970-01-01T14:30:00Z';
const TIME_1430 = '14:30:00';
const YEAR_2025_START_ISO = '2025-01-01T00:00:00Z';
const YEAR_2025_END_ISO = '2025-12-31T00:00:00Z';
const YEAR_2025_RANGE = '2025-01-01/2025-12-31';
const JAN_01_MORNING_ISO = '2025-01-01T08:00:00Z';
const JAN_01_EVENING_ISO = '2025-01-01T17:00:00Z';
const JAN_01_RANGE = '2025-01-01T08:00:00/2025-01-01T17:00:00';

// =============================================================================
// Mock helpers
// =============================================================================

/** Simulates java.time.Instant via duck-typing (toEpochMilli + toString). */
function mockInstant(isoString: string) {
	return { toEpochMilli: () => 0, toString: () => isoString };
}

/** Simulates an InstantRange (DateRange) with start()/end() Instants. */
function mockInstantRange(startIso: string, endIso: string) {
	return { start: () => mockInstant(startIso), end: () => mockInstant(endIso) };
}

/**
 * Simulates java.time.Instant as typeof='function' — observed in CIB7 and DataServices
 * GraalJS environments where Java host objects surface as callable.
 */
function mockFunctionInstant(isoString: string): unknown {
	return Object.assign(() => {}, { toString: () => isoString });
}

/** Simulates an InstantRange as typeof='function' with function-typed start()/end(). */
function mockFunctionInstantRange(startIso: string, endIso: string): unknown {
	return Object.assign(() => {}, {
		start: () => mockFunctionInstant(startIso),
		end: () => mockFunctionInstant(endIso),
		toString: () => `[${startIso}, ${endIso}]`,
	});
}

// =============================================================================
// convertJavaFieldValue — null / passthrough
// =============================================================================

describe('convertJavaFieldValue', () => {
	describe('null and passthrough', () => {
		it('returns null unchanged', () => {
			expect(convertJavaFieldValue(null)).toBeNull();
		});

		it('returns undefined unchanged', () => {
			expect(convertJavaFieldValue(undefined)).toBeUndefined();
		});

		it('returns JS string unchanged', () => {
			expect(convertJavaFieldValue('hello')).toBe('hello');
		});

		it('returns JS number unchanged', () => {
			expect(convertJavaFieldValue(42)).toBe(42);
		});

		it('returns JS boolean unchanged', () => {
			expect(convertJavaFieldValue(true)).toBe(true);
		});
	});

	// =============================================================================
	// java.time.Instant (Kernel 30.7+)
	// =============================================================================

	describe('java.time.Instant — date-only', () => {
		it('returns date string for midnight UTC', () => {
			expect(convertJavaFieldValue(mockInstant(JAN_30_MIDNIGHT_ISO))).toBe(JAN_30_DATE);
		});

		it('returns date string for a different date', () => {
			expect(convertJavaFieldValue(mockInstant(JUN_15_MIDNIGHT_ISO))).toBe(JUN_15_DATE);
		});
	});

	describe('java.time.Instant — datetime', () => {
		it('strips Z suffix for datetime Instant', () => {
			expect(convertJavaFieldValue(mockInstant(JAN_30_DATETIME_ISO))).toBe(JAN_30_DATETIME_RESULT);
		});

		it('truncates to seconds when Z is stripped', () => {
			expect(convertJavaFieldValue(mockInstant('2025-01-30T14:30:00.500Z'))).toBe(JAN_30_DATETIME_RESULT);
		});
	});

	// =============================================================================
	// GraalJS auto-converted JS Date (via toISOString detection)
	// =============================================================================

	describe('GraalJS auto-converted JS Date (toISOString present)', () => {
		const jsDate = (isoString: string) => ({ toISOString: () => isoString });

		it('returns date string for midnight UTC with ms', () => {
			expect(convertJavaFieldValue(jsDate('2025-01-30T00:00:00.000Z'))).toBe(JAN_30_DATE);
		});

		it('returns datetime string for non-midnight', () => {
			expect(convertJavaFieldValue(jsDate('2025-01-30T14:30:00.000Z'))).toBe(JAN_30_DATETIME_RESULT);
		});

		it('returns time string for epoch date', () => {
			expect(convertJavaFieldValue(jsDate('1970-01-01T14:30:00.000Z'))).toBe(TIME_1430);
		});
	});

	describe('java.time.Instant — time-only', () => {
		it('returns HH:mm:ss for epoch-date Instant', () => {
			expect(convertJavaFieldValue(mockInstant(EPOCH_DATETIME_ISO))).toBe(TIME_1430);
		});

		it('returns HH:mm:ss for epoch midnight', () => {
			expect(convertJavaFieldValue(mockInstant('1970-01-01T00:00:00Z'))).toBe('00:00:00');
		});
	});

	// =============================================================================
	// InstantRange (Kernel 30.7+)
	// =============================================================================

	describe('InstantRange — DateRange', () => {
		it('returns start/end string for date range', () => {
			expect(convertJavaFieldValue(mockInstantRange(YEAR_2025_START_ISO, YEAR_2025_END_ISO)))
				.toBe(YEAR_2025_RANGE);
		});

		it('returns start/end string for datetime range', () => {
			expect(convertJavaFieldValue(mockInstantRange(JAN_01_MORNING_ISO, JAN_01_EVENING_ISO)))
				.toBe(JAN_01_RANGE);
		});
	});

	// =============================================================================
	// typeof='function' Java host objects (CIB7 / DataServices GraalJS environment)
	// =============================================================================

	describe('java.time.Instant as typeof=function — date-only', () => {
		it('returns date string for midnight UTC', () => {
			expect(convertJavaFieldValue(mockFunctionInstant(JAN_30_MIDNIGHT_ISO))).toBe(JAN_30_DATE);
		});

		it('returns date string for a different date', () => {
			expect(convertJavaFieldValue(mockFunctionInstant(JUN_15_MIDNIGHT_ISO))).toBe(JUN_15_DATE);
		});
	});

	describe('java.time.Instant as typeof=function — datetime', () => {
		it('returns datetime string for non-midnight', () => {
			expect(convertJavaFieldValue(mockFunctionInstant(JAN_30_DATETIME_ISO))).toBe(JAN_30_DATETIME_RESULT);
		});
	});

	describe('java.time.Instant as typeof=function — time-only', () => {
		it('returns HH:mm:ss for epoch-date Instant', () => {
			expect(convertJavaFieldValue(mockFunctionInstant(EPOCH_DATETIME_ISO))).toBe(TIME_1430);
		});
	});

	describe('InstantRange as typeof=function — DateRange', () => {
		it('returns start/end string for date range', () => {
			expect(convertJavaFieldValue(mockFunctionInstantRange(YEAR_2025_START_ISO, YEAR_2025_END_ISO)))
				.toBe(YEAR_2025_RANGE);
		});

		it('returns start/end string for datetime range', () => {
			expect(convertJavaFieldValue(mockFunctionInstantRange(JAN_01_MORNING_ISO, JAN_01_EVENING_ISO)))
				.toBe(JAN_01_RANGE);
		});
	});

	// =============================================================================
	// Java Number and Boolean wrappers
	// =============================================================================

	describe('Java Number wrapper', () => {
		it('returns doubleValue() result', () => {
			expect(convertJavaFieldValue({ doubleValue: () => 3.14 })).toBe(3.14);
		});

		it('returns integer via doubleValue()', () => {
			expect(convertJavaFieldValue({ doubleValue: () => 42 })).toBe(42);
		});
	});

	describe('Java Boolean wrapper', () => {
		it('returns booleanValue() result for true', () => {
			expect(convertJavaFieldValue({ booleanValue: () => true })).toBe(true);
		});

		it('returns booleanValue() result for false', () => {
			expect(convertJavaFieldValue({ booleanValue: () => false })).toBe(false);
		});
	});
});

// =============================================================================
// unwrapOptional
// =============================================================================

function mockPresentOptional<T>(value: T): JavaOptional<T> {
	return { isPresent: () => true, isEmpty: () => false, get: () => value, orElse: () => value, orElseGet: () => value };
}

function mockEmptyOptional<T>(): JavaOptional<T> {
	return { isPresent: () => false, isEmpty: () => true, get: () => { throw new Error('empty'); }, orElse: (v) => v, orElseGet: (s) => s() };
}

describe('unwrapOptional', () => {
	it('unwraps a present Java Optional', () => {
		expect(unwrapOptional(mockPresentOptional('wrapped'))).toBe('wrapped');
	});

	it('returns null from an empty Java Optional', () => {
		expect(unwrapOptional(mockEmptyOptional<string>())).toBeNull();
	});

	it('returns null for null input', () => {
		expect(unwrapOptional(null)).toBeNull();
	});

	it('passes through non-Optional values unchanged', () => {
		expect(unwrapOptional('already-a-string' as unknown)).toBe('already-a-string');
	});
});
