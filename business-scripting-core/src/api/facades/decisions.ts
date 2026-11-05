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

/**
 * Functionality about Decisions / Business Rules.
 * @public
 */

/** Checks if a variable is empty.
 * @example
 * ```ts
 * const isEmpty = A12.Decisions.isEmpty(variable)
 * ```
 */
export function isEmpty(variable: unknown): boolean {
	if (Array.isArray(variable)) {
		return variable.length === 0;
	}
	return variable === undefined || variable === null || variable === '';
}

/** Checks if a variable is not empty.
 * @example
 * ```ts
 * const isNotEmpty = A12.Decisions.isNotEmpty(variable)
 * ```
 */
export function isNotEmpty(variable: unknown): boolean {
	return !isEmpty(variable);
}

/** Checks if a list (array) has a specified size.
 * @example
 * ```ts
 * const hasSize = A12.Decisions.hasSpecifiedSize(list, 3)
 * ```
 */
export function hasSpecifiedSize(list: unknown[], size: number): boolean {
	return list.length === size;
}

/**
 * Checks whether a number is within a given range.
 * Only one of the bounds (min or max) is required.
 *
 * @example
 * ```ts
 * const isAbove50 = A12.Decisions.isInRange(n, 51)            // n > 50
 * const isBelow50 = A12.Decisions.isInRange(n, undefined, 49) // n < 50
 * const isBetween = A12.Decisions.isInRange(n, 11, 99)        // 10 < n < 100
 * ```
 */
export function isInRange(num: number, min?: number, max?: number): boolean {
	if (min !== undefined && num < min) {
		return false;
	}
	if (max !== undefined && num > max) {
		return false;
	}
	return true;
}

/** Checks if a string contains the specified substring.
 * @example
 * ```ts
 * const contains = A12.Decisions.containsSubstring(str, "search")
 * ```
 */
export function containsSubstring(str: string, substring: string): boolean {
	return str.indexOf(substring) !== -1;
}

/**
 * Checks if two values (or variables) are equal.
 * This can also be used to compare dates, numbers, enums, or strings.
 * Both arguments must be of the same type.
 * @example
 * ```ts
 * const isEqual = A12.Decisions.isEqual(a, b)
 * ```
 */
export function isEqual<T>(a: T, b: NoInfer<T>): boolean {
	return a == b;
}

/** Checks if two values (or variables) are not equal.
 * Both arguments must be of the same type.
 * @example
 * ```ts
 * const isNotEqual = A12.Decisions.isNotEqual(a, b)
 * ```
 */
export function isNotEqual<T>(a: T, b: NoInfer<T>): boolean {
	return a != b;
}
