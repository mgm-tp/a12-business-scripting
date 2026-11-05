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
 * The GraalJS polyglot interop object, injected into every script scope as `Java`.
 * @see https://www.graalvm.org/latest/reference-manual/js/JavaInteroperability/
 */
export interface JavaInterop {
	/**
	 * Resolves a fully qualified Java class name to its class object.
	 */
	type(className: string): unknown;

	/** Converts a JS value to the given Java type, e.g. `Java.to(numbers, 'int[]')`. */
	to<T = unknown>(value: unknown, javaType: string): T;

	/** Converts a Java value to its JS equivalent. */
	from<T = unknown>(javaValue: unknown): T;
}

/**
 * The interop object GraalVM injects as `Java`, captured when the bundle is evaluated. Keep it a
 * `const` holding the global, never a function returning it — see this directory's README,
 * *Runtime code*.
 */
export const Java = globalThis.Java;
