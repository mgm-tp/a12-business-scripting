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

// ABOUTME: Type declarations for DocumentReference Java class
// ABOUTME: Enables calling DocumentReference methods from GraalJS scripts

/**
 * Checks whether a value is the Java DocumentReference handed over by GraalJS, which exposes the
 * methods of the Java class as members. Checking for the getters rather than for the
 * "documentModelName" and "documentId" properties keeps a plain object that happens to carry those
 * two fields from being mistaken for a document reference.
 */
export function isJavaDocumentReference(value: unknown): value is DocumentReference {
	return value !== null &&
		typeof value === 'object' &&
		typeof (value as Partial<DocumentReference>).getDocumentModelName === 'function' &&
		typeof (value as Partial<DocumentReference>).getDocumentId === 'function';
}

/**
 * A Java DocumentReference after the workflow engine has serialized it to
 * `{documentModelName, documentId, valid, empty}` instead of to a "documentModelName/documentId"
 * string. Only the two fields Business Scripting reads are declared.
 * @see com.mgmtp.a12.dataservices.document.DocumentReference
 */
export interface BeanSerializedDocumentReference {
	documentModelName: string;
	documentId: string;
}

/**
 * Checks whether a value is a {@link BeanSerializedDocumentReference}. Run this only after
 * {@link isJavaDocumentReference} has ruled out a real Java document reference, which carries the
 * same two properties alongside its getters.
 */
export function isBeanSerializedDocumentReference(value: unknown): value is BeanSerializedDocumentReference {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<BeanSerializedDocumentReference>;
	return typeof candidate.documentModelName === 'string' && typeof candidate.documentId === 'string';
}

/**
 * A compiled java.util.regex.Pattern.
 * Opaque: it does not surface as a JavaScript RegExp through GraalJS, so it cannot be used with
 * `test`, `exec` or any RegExp method.
 * @see java.util.regex.Pattern
 */
export type JavaPattern = object;

/**
 * An instance of the Java DocumentReference class.
 * @see com.mgmtp.a12.dataservices.document.DocumentReference
 */
export interface DocumentReference {
	/**
	 * Load-bearing beyond being read: these two properties are what makes the value returned by
	 * `DataServicesRpcFacade.tryAddDocument` structurally assignable to the Business Scripting
	 * `DocumentReference` class in `api/document-reference.ts`, which declares exactly these two
	 * fields. Removing them breaks `Documents.create` in the workflow context.
	 */
	readonly documentModelName: string;
	readonly documentId: string;

	// Instance methods
	isValid(): boolean;
	toString(): string;
	length(): number;
	charAt(index: number): string;
	subSequence(start: number, end: number): string;
	compareTo(other: DocumentReference | null): number;

	// Getters/setters
	getDocumentModelName(): string;
	getDocumentId(): string;
	setDocumentModelName(documentModelName: string): void;
	setDocumentId(documentId: string): void;
}

/**
 * Java class proxy for DocumentReference, as returned by {@link Java.type}.
 * Carries the constructors and static fields, which are members of the class rather than of an
 * instance.
 * @see com.mgmtp.a12.dataservices.document.DocumentReference
 */
export interface DocumentReferenceJavaClass {
	new (documentModelName: string, documentId: string): DocumentReference;
	new (docRef: string): DocumentReference;

	readonly SEPARATOR: string;
	readonly MODEL_NAME_PATTERN: JavaPattern;
}
