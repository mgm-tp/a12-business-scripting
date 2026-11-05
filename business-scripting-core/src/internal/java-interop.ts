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

import {
	DocumentPart,
	DocumentReference as JavaDocumentReference,
	isJavaBoolean,
	isJavaInstantRange,
	isJavaNumber,
	JavaDocumentPart,
	JavaInstantRange,
	JavaOptional,
	Locale,
} from '../graaljs-compat-typings/index.js';
import {DocumentReference} from "../api/index.js";

import { getDocumentPartJavaClass, getDocumentReferenceJavaClass, getInstantJavaClass, getLocaleJavaClass } from './java-classes.js';

/** Matches java.time.Instant.toString() output: ISO-8601 UTC with optional sub-seconds. */
const ISO_INSTANT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

// =============================================================================
// Java Type Conversions
// =============================================================================

/** Gets the default Java Locale. */
export function getDefaultLocale(): Locale {
	return getLocaleJavaClass().getDefault();
}

/** Converts a locale string such as "de-DE" to a Java Locale, or undefined if no locale was given. */
export function toJavaLocale(localeString: string | undefined): Locale | undefined {
	return localeString ? getLocaleJavaClass().of(localeString) : undefined;
}

/** Converts a TypeScript DocumentPart to a Java DocumentPart. */
export function toJavaDocumentPart(tsPart: DocumentPart): JavaDocumentPart {
	const JavaDocumentPart = getDocumentPartJavaClass();
	return new JavaDocumentPart(tsPart.path, tsPart.value, tsPart.repetitions);
}

/** Converts a TypeScript DocumentReference to a Java DocumentReference. */
export function toJavaDocumentReference(docRef: DocumentReference): JavaDocumentReference {
	const JavaDocumentReference = getDocumentReferenceJavaClass();
	return new JavaDocumentReference(docRef.toString());
}

/** Unwraps Java Optional if present, otherwise returns value as-is */
export function unwrapOptional<T>(value: JavaOptional<T> | T | null): T | null {
	if (value && typeof (value as JavaOptional<T>).orElse === 'function') {
		return (value as JavaOptional<T>).orElse(null as T);
	}
	return (value ?? null) as T | null;
}

/**
 * Converts a Java field value to a JS-native equivalent.
 *
 * Java host objects surfaced through GraalJS (numbers, booleans, dates) do not auto-unwrap
 * to JS primitives. Without conversion, `typeof javaNumber === "object"` and scripts cannot
 * use `===`, JSON.stringify, or arithmetic on read values as documented in `Documents.read`.
 *
 * Conversions:
 * - Java Number wrappers (BigDecimal, Long, Integer, ...) → JS `number` via `.doubleValue()`.
 * - Java Boolean wrapper → JS `boolean` via `.booleanValue()`.
 * - java.time.Instant (Kernel 30.7+: Date, DateTime, Time, DateFragment) → ISO string.
 * - InstantRange (Kernel 30.7+: DateRange) → "start/end" string.
 * - All other values are returned as-is (JS primitives already pass through unchanged).
 *
 * **Known Limitations:**
 * - **DateFragment:** Cannot be distinguished from Date (both stored as the same type).
 *   "2025-01" is stored as a date at 2025-01-01 and returned as "2025-01-01".
 */
export function convertJavaFieldValue(value: unknown): unknown {
	if (value == null) {
		return value;
	}

	// GraalJS may auto-convert java.time.Instant or java.util.Date to a native JS Date.
	// toISOString() is exclusive to native JS Date — not present on any Java host object.
	if (typeof value === 'object' && typeof (value as Record<string, unknown>)['toISOString'] === 'function') {
		return instantToFieldString((value as { toISOString(): string }).toISOString());
	}

	// In some GraalJS environments (observed in CIB7 and DataServices), Java host objects
	// surface as typeof='function' instead of typeof='object'. A java.time.Instant in this
	// mode is identified by its Instant.toString() ISO-8601 UTC output. An InstantRange is
	// identified by start()/end() accessors whose return values also match the pattern.
	if (typeof value === 'function') {
		const iso = String(value);
		if (ISO_INSTANT_REGEX.test(iso)) {
			return instantToFieldString(iso);
		}
		const range = value as unknown as JavaInstantRange;
		if (typeof range.start === 'function' && typeof range.end === 'function') {
			return `${instantToFieldString(String(range.start()))}/${instantToFieldString(String(range.end()))}`;
		}
	}

	// Kernel 30.7+: date/time fields stored as java.time.Instant (when not auto-converted)
	if (isJavaInstant(value)) {
		return instantToFieldString(value);
	}

	// Kernel 30.7+: DateRange stored as InstantRange with start()/end()
	if (isJavaInstantRange(value)) {
		return `${instantToFieldString(value.start())}/${instantToFieldString(value.end())}`;
	}

	if (isJavaNumber(value)) { return value.doubleValue(); }
	if (isJavaBoolean(value)) { return value.booleanValue(); }

	return value;
}

/**
 * Returns true if the value is a java.time.Instant.
 * Uses Java.type instanceof check in GraalJS; falls back to duck-typing in unit test environments.
 */
function isJavaInstant(value: unknown): boolean {
	try {
		return getInstantJavaClass().isInstance(value);
	} catch {
		if (typeof value !== 'object' || value === null) { return false; }
		if ('toEpochMilli' in (value as object)) { return true; }
		return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(String(value));
	}
}

/**
 * Formats an ISO-8601 UTC date string (from java.time.Instant.toString() or JS Date.toISOString())
 * into the field string format used by A12 date/time types.
 * - Epoch date (1970-01-01T...) → time-only `HH:mm:ss`
 * - Midnight UTC (T00:00:00[.xxx]Z) → date-only `yyyy-MM-dd`
 * - Otherwise → `yyyy-MM-ddTHH:mm:ss` (truncates to seconds, strips Z and fractional seconds)
 */
function instantToFieldString(instant: unknown): string {
	const iso = String(instant);
	if (iso.startsWith('1970-01-01T')) {
		return iso.substring(11, 19);
	}
	if (/T00:00:00(?:\.\d+)?Z$/.test(iso)) {
		return iso.substring(0, 10);
	}
	if (iso.endsWith('Z')) {
		return iso.substring(0, 19);
	}
	return iso;
}
