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


import { ScriptingError } from "./errors.js";

/**
 * A simple wrapper around an array that provides convenient access methods.
 */
export class SimpleList<T> {
	private readonly items: T[];

	/**
	 * Create a new SimpleList
	 * @param items Optional initial items
	 */
	constructor(items: T[] = []) {
		this.items = [...items]; // Create a copy of the array to avoid external mutations
	}

	/**
	 * Get the first item in the list or throw error if empty
	 */
	first(): T {
		if (this.items.length > 0) {
			return this.items[0]!;
		} else {
			throw new ScriptingError('[SimpleList] List is empty, no first item available');
		}
	}

	/**
	 * Get the first item in the list or undefined if empty
	 */
	firstOrUndefined(): T | undefined {
		return this.items.length > 0 ? this.items[0] : undefined;
	}

	/**
	 * Get the last item in the list or throw error if empty
	 */
	last(): T {
		if (this.items.length > 0) {
			return this.items[this.items.length - 1]!;
		} else {
			throw new ScriptingError('[SimpleList] List is empty, no last item available');
		}
	}

	/**
	 * Get the last item in the list or undefined if empty
	 */
	lastOrUndefined(): T | undefined {
		return this.items.length > 0 ? this.items[this.items.length - 1] : undefined;
	}

	/**
	 * Check if the list is empty
	 */
	isEmpty(): boolean {
		return this.items.length === 0;
	}

	/**
	 * Get the number of items in the list
	 */
	size(): number {
		return this.items.length;
	}

	/**
	 * Get an item at the specified index or throw error if out of bounds
	 */
	get(index: number): T | undefined {
		if (index >= 0 && index < this.items.length) {
			return this.items[index];
		} else {
			throw new ScriptingError(`[SimpleList] Index ${index} is out of bounds for list of size ${this.items.length}`);
		}
	}

	/**
	 * Get a copy of the underlying array for iteration or further processing
	 */
	toArray(): T[] {
		return [...this.items];
	}

	static isSimpleListShape(value: unknown): value is { items: unknown[] } {
		return value !== null &&
			typeof value === 'object' &&
			'items' in value &&
			Array.isArray((value as Record<string, unknown>).items);
	}
}
