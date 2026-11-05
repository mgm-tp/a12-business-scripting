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
 * TypeScript representation of java.util.Iterator for GraalVM interop.
 */
export interface JavaIterator<T> {
	hasNext(): boolean;
	next(): T;
}

/**
 * TypeScript representation of java.util.Collection for GraalVM interop.
 * In GraalJS, Java collections are iterable with for...of loops.
 */
export interface JavaCollection<T> extends Iterable<T> {
	size(): number;
	isEmpty(): boolean;
	contains(element: T): boolean;
	iterator(): JavaIterator<T>;
	toArray(): T[];
	add(element: T): boolean;
	remove(element: T): boolean;
	clear(): void;
	[Symbol.iterator](): Iterator<T>;
}

/**
 * TypeScript representation of java.util.Set for GraalVM interop.
 * Structurally identical to JavaCollection; kept as a named alias for readability at call sites.
 */
export type JavaSet<T> = JavaCollection<T>;

/**
 * TypeScript representation of java.util.List for GraalVM interop.
 */
export interface JavaList<T> extends JavaCollection<T> {
	get(index: number): T;
	set(index: number, element: T): T;
	indexOf(element: T): number;
	lastIndexOf(element: T): number;
}

/**
 * Checks for the methods of the Java class, so that a plain object carrying a "size" or "get" field
 * is not mistaken for a Java list.
 */
export function isJavaList(value: unknown): value is JavaList<unknown> {
	return value !== null &&
		typeof value === 'object' &&
		typeof (value as Partial<JavaList<unknown>>).size === 'function' &&
		typeof (value as Partial<JavaList<unknown>>).get === 'function';
}

/**
 * Copies the elements into a JS array, which stays usable after the GraalJS context is closed.
 */
export function javaListToArray<T>(javaList: JavaList<T>): T[] {
	const items: T[] = [];
	for (let index = 0; index < javaList.size(); index++) {
		items.push(javaList.get(index));
	}
	return items;
}

/**
 * TypeScript representation of java.util.Map.Entry for GraalVM interop.
 */
export interface JavaMapEntry<K, V> {
    getKey(): K;
    getValue(): V;
}
