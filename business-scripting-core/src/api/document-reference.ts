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

const DOC_REF_SEPARATOR = '/';
const RELATIVE_PATH_SEGMENT = '..';
const DOC_REF_FORMAT_HINT = `A document reference must have the format 'documentModelName${DOC_REF_SEPARATOR}documentId'.`;

// Model name rule of DataServices' DocumentReference: its MODEL_NAME_PATTERN, narrowed to the
// at-least-two-characters rule that the DataServices constructor enforces on top of the pattern.
const DOCUMENT_MODEL_NAME_PATTERN = /^[_a-zA-Z][-_.a-zA-Z0-9]{1,99}$/;

// Neither part of a document reference may carry a separator or a relative path segment, so that a
// reference always denotes exactly one document and can never be read as a path.
function containsSeparatorOrRelativePathSegment(documentReferencePart: string): boolean {
	return documentReferencePart.includes(DOC_REF_SEPARATOR) || documentReferencePart.includes(RELATIVE_PATH_SEGMENT);
}

function isValidDocumentModelName(documentModelName: string): boolean {
	return DOCUMENT_MODEL_NAME_PATTERN.test(documentModelName) && !containsSeparatorOrRelativePathSegment(documentModelName);
}

function isValidDocumentId(documentId: string): boolean {
	return documentId.trim() !== '' && !containsSeparatorOrRelativePathSegment(documentId);
}

function verifyDocumentModelNameOrThrow(documentModelName: string): void {
	if (!isValidDocumentModelName(documentModelName)) {
		throw new Error(
			`Invalid document model name '${documentModelName}'. It must be at least 2 characters long and ` +
			`must not contain '${DOC_REF_SEPARATOR}' or '${RELATIVE_PATH_SEGMENT}'.`,
		);
	}
}

function verifyDocumentIdOrThrow(documentId: string): void {
	if (!isValidDocumentId(documentId)) {
		throw new Error(
			`Invalid document id '${documentId}'. It must not be empty and must not contain ` +
			`'${DOC_REF_SEPARATOR}' or '${RELATIVE_PATH_SEGMENT}'.`,
		);
	}
}

/**
 * Reports whether a string is a document reference, i.e. whether {@link DocumentReference.fromString}
 * accepts it. Used to tell a document reference from an ordinary string of the same shape.
 * @internal
 */
export function isDocumentReferenceString(candidate: string): boolean {
	const separatorIndex = candidate.indexOf(DOC_REF_SEPARATOR);
	return separatorIndex >= 0 &&
		isValidDocumentModelName(candidate.slice(0, separatorIndex)) &&
		isValidDocumentId(candidate.slice(separatorIndex + 1));
}

export class DocumentReference {
	readonly documentModelName: string;
	readonly documentId: string;

	/**
	 * @throws Error If the model name or the document id breaks the DataServices document reference rules.
	 */
	constructor(documentModelName: string, documentId: string) {
		verifyDocumentModelNameOrThrow(documentModelName);
		verifyDocumentIdOrThrow(documentId);
		this.documentModelName = documentModelName;
		this.documentId = documentId;
	}

	/**
	 * Parses a "documentModelName/documentId" string.
	 * @throws Error If the string carries no separator, or the model name or the document id is invalid.
	 */
	static fromString(docRefString: string): DocumentReference {
		const separatorIndex = docRefString.indexOf(DOC_REF_SEPARATOR);
		if (separatorIndex < 0) {
			throw new Error(`Invalid document reference '${docRefString}'. ${DOC_REF_FORMAT_HINT}`);
		}
		return new DocumentReference(docRefString.slice(0, separatorIndex), docRefString.slice(separatorIndex + 1));
	}

	public toString(): string {
		return this.documentModelName + DOC_REF_SEPARATOR + this.documentId;
	}
}
