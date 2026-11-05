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

import type * as GraalJsBarrel from '../graaljs-compat-typings/index.js';

/**
 * Builds the `vi.mock` factory for `graaljs-compat-typings/index.js`: every export is kept, only
 * `Java.type` is replaced by a lookup in `javaClassesByName`. A class name that is not listed
 * throws, so a typo fails at the call instead of returning `undefined`.
 *
 * ```ts
 * vi.mock('../graaljs-compat-typings/index.js', mockGraalJsBarrelWithJavaClasses({
 *     'java.io.StringWriter': class StringWriter {},
 * }));
 * ```
 */
export function mockGraalJsBarrelWithJavaClasses(javaClassesByName: Record<string, unknown>) {
	return async (importOriginal: <T>() => Promise<T>) => ({
		...await importOriginal<typeof GraalJsBarrel>(),
		Java: {
			type: (className: string) => {
				const javaClass = javaClassesByName[className];
				if (javaClass === undefined) {
					throw new Error(`Unexpected Java.type in test: ${className}`);
				}
				return javaClass;
			},
		},
	});
}
