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

import { SimpleList } from '../../simple-list.js';
import { ScriptingError } from '../../errors.js';

enum FailConditionType {
	Undefined = 'undefined',
	EmptyList = 'emptyList',
	UnexpectedSize = 'unexpectedSize',
}

type FailCondition =
	| { type: FailConditionType.Undefined }
	| { type: FailConditionType.EmptyList }
	| { type: FailConditionType.UnexpectedSize; expectedSize: number };

export const FailConditionFactory = {
	Undefined: (): FailCondition => ({ type: FailConditionType.Undefined }),
	EmptyList: (): FailCondition => ({ type: FailConditionType.EmptyList }),
	UnexpectedSize: (expectedSize: number): FailCondition => ({ type: FailConditionType.UnexpectedSize, expectedSize }),
};

/**
 * Test an element with specified failure conditions. An error is thrown if any of the failure conditions is true
 * @param element - The object to test
 * @param failConditions - The conditions that are supposed to cause an error if true
 * @param makeError - A factory that receives the failure message and returns the error to throw
 *
 * @example
 * ```ts
 * // Throws: "Example - The provided element must not be undefined!"
 * testFailConditions(undefined, [FailConditionFactory.Undefined()], (msg) => new ScriptingError(`Example - ${msg}`))
 *
 * // Throws: "Example - The provided element must not be an empty list!"
 * testFailConditions(emptyArray, [FailConditionFactory.EmptyList()], (msg) => new ScriptingError(`Example - ${msg}`))
 *
 * // Throws: "Example - The provided element must not have an unexpected size! Expected 2, got 1."
 * testFailConditions([1], [FailConditionFactory.UnexpectedSize(2)], (msg) => new ScriptingError(`Example - ${msg}`))
 * ```
 */
export function testFailConditions<T>(element: T | T[], failConditions: FailCondition[], makeError: (message: string) => ScriptingError) {
	failConditions.forEach((condition) => {
		switch (condition.type) {
			case FailConditionType.Undefined:
				if (element === undefined) {
					throw makeError('The provided element must not be undefined!');
				}
				break;
			case FailConditionType.EmptyList:
				if ((element instanceof SimpleList && element.size() === 0) || (Array.isArray(element) && element.length === 0)) {
					throw makeError('The provided element must not be an empty list!');
				}
				break;
			case FailConditionType.UnexpectedSize: {
				let arrayLike;
				if (element instanceof SimpleList) {
					arrayLike = element.toArray();
				} else if (Array.isArray(element)) {
					arrayLike = element;
				} else {
					break;
				}
				const nonUndefinedElements = arrayLike.filter((e) => e !== undefined);
				if (nonUndefinedElements.length !== condition.expectedSize) {
					throw makeError(`The provided element must not have an unexpected size! Expected ${condition.expectedSize}, got ${nonUndefinedElements.length}.`);
				}
				break;
			}
		}
	});
}
