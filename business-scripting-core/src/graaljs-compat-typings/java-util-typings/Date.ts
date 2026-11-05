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
 * TypeScript representation of java.time.Instant for GraalVM interop.
 * @see java.time.Instant
 */
export interface JavaInstant {
    toEpochMilli(): number;
    getEpochSecond(): number;
    getNano(): number;
    toString(): string;
}

/**
 * Java class proxy for Instant, as returned by {@link Java.type}.
 * @see java.time.Instant
 */
export interface InstantJavaClass {
    /** Returns true if the value is a java.time.Instant. Only available inside GraalJS. */
    isInstance(value: unknown): boolean;
}

/**
 * A java.time.Instant or compatible range with start/end accessors.
 * Used for Kernel 30.7+ DateRange field values stored as InstantRange.
 * @see com.mgmtp.a12.kernel.md.document.apiV2.immutable.InstantRange (or equivalent)
 */
export interface JavaInstantRange {
	start(): unknown;
	end(): unknown;
}

/**
 * Type guard for Kernel InstantRange objects (DateRange fields in DocumentV2).
 */
export function isJavaInstantRange(value: unknown): value is JavaInstantRange {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return typeof candidate['start'] === 'function' && typeof candidate['end'] === 'function';
}
