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

import {describe, expect, it} from 'vitest';

import {DocumentReference, isDocumentReferenceString} from '../api/document-reference.js';

const DOCUMENT_MODEL_NAME = 'Project_DM';
const DOCUMENT_ID = '82e571e5-4671-42f5-846d-cb1fa3a82e7e';
const MISSING_SEPARATOR_MESSAGE = 'must have the format';
const INVALID_MODEL_NAME_MESSAGE = 'Invalid document model name';
const INVALID_DOCUMENT_ID_MESSAGE = 'Invalid document id';

describe('DocumentReference', () => {
    describe('constructor', () => {
        it('should accept a model name matching the DataServices model name pattern', () => {
            const docRef = new DocumentReference(DOCUMENT_MODEL_NAME, DOCUMENT_ID);
            expect(docRef.documentModelName).toBe(DOCUMENT_MODEL_NAME);
            expect(docRef.documentId).toBe(DOCUMENT_ID);
        });

        it.each([
            ['shorter than two characters', 'P'],
            ['empty', ''],
            ['starting with a digit', '1Project_DM'],
            ['starting with a hyphen', '-Project_DM'],
            ['containing a separator', 'Project/DM'],
            ['containing a relative path segment', 'Project..DM'],
            ['containing a space', 'Project DM'],
            ['containing a character outside the pattern', 'Project$DM'],
            ['longer than 100 characters', `P${'r'.repeat(100)}`],
        ])('should throw for a model name %s', (_, invalidDocumentModelName) => {
            expect(() => new DocumentReference(invalidDocumentModelName, DOCUMENT_ID))
                .toThrow(INVALID_MODEL_NAME_MESSAGE);
        });

        // Asserts the whole message, not a substring: scripters are non-technical, so the rule they
        // are told to follow has to read as a sentence.
        it('should state the complete model name rule in the error message', () => {
            expect(() => new DocumentReference('P', DOCUMENT_ID)).toThrow(
                "Invalid document model name 'P'. It must be at least 2 characters long and must not contain '/' or '..'.",
            );
        });

        it.each([
            ['empty', ''],
            ['blank', '   '],
            ['containing a separator', `nested/${DOCUMENT_ID}`],
            ['containing a relative path segment', `..${DOCUMENT_ID}`],
        ])('should throw for a document id %s', (_, invalidDocumentId) => {
            expect(() => new DocumentReference(DOCUMENT_MODEL_NAME, invalidDocumentId))
                .toThrow(INVALID_DOCUMENT_ID_MESSAGE);
        });
    });

    describe('fromString', () => {
        it('should split a docRef into model name and document id', () => {
            expect(DocumentReference.fromString(`${DOCUMENT_MODEL_NAME}/${DOCUMENT_ID}`))
                .toEqual(new DocumentReference(DOCUMENT_MODEL_NAME, DOCUMENT_ID));
        });

        it.each([
            ['no separator', 'Project_DM'],
            ['empty string', ''],
        ])('should throw for %s', (_, invalidDocRef) => {
            expect(() => DocumentReference.fromString(invalidDocRef)).toThrow(MISSING_SEPARATOR_MESSAGE);
        });

        it('should throw for a missing model name', () => {
            expect(() => DocumentReference.fromString(`/${DOCUMENT_ID}`)).toThrow(INVALID_MODEL_NAME_MESSAGE);
        });

        it('should throw for a missing document id', () => {
            expect(() => DocumentReference.fromString(`${DOCUMENT_MODEL_NAME}/`)).toThrow(INVALID_DOCUMENT_ID_MESSAGE);
        });

        it('should throw for a second separator, which a document id may not contain', () => {
            expect(() => DocumentReference.fromString(`${DOCUMENT_MODEL_NAME}/nested/${DOCUMENT_ID}`))
                .toThrow(INVALID_DOCUMENT_ID_MESSAGE);
        });

        it('should round-trip through toString', () => {
            const docRefString = `${DOCUMENT_MODEL_NAME}/${DOCUMENT_ID}`;
            expect(DocumentReference.fromString(docRefString).toString()).toBe(docRefString);
        });
    });
});

// The strings `parseIfDocRef` must convert, and no others. Every entry doubles as an assertion that
// `fromString` parses it, because a string this predicate accepts but `fromString` rejects would make
// `parseIfDocRef` throw on a script result it was supposed to pass through.
const ACCEPTED_DOC_REF_STRINGS = [
    ['a model name and a document id', `${DOCUMENT_MODEL_NAME}/${DOCUMENT_ID}`],
    ['the shortest accepted model name', 'Pr/1'],
    ['a model name containing a single dot', 'Project.DM/1'],
];

describe('isDocumentReferenceString', () => {
    it.each(ACCEPTED_DOC_REF_STRINGS)('should accept %s', (_, docRefString) => {
        expect(isDocumentReferenceString(docRefString!)).toBe(true);
    });

    it.each(ACCEPTED_DOC_REF_STRINGS)('should accept only what fromString parses: %s', (_, docRefString) => {
        expect(DocumentReference.fromString(docRefString!).toString()).toBe(docRefString);
    });

    it.each([
        ['no separator', DOCUMENT_MODEL_NAME],
        ['an empty string', ''],
        ['a missing model name', `/${DOCUMENT_ID}`],
        ['a missing document id', `${DOCUMENT_MODEL_NAME}/`],
        ['a blank document id', `${DOCUMENT_MODEL_NAME}/   `],
        // "path" is a valid model name, so only the second separator disqualifies this one. This is the
        // shape an ordinary script output string is most likely to have.
        ['a second separator', 'path/to/file'],
        ['a document id that is a relative path segment', `${DOCUMENT_MODEL_NAME}/..`],
        ['a document id containing a relative path segment', `${DOCUMENT_MODEL_NAME}/a..b`],
        ['a model name containing a relative path segment', 'Project..DM/1'],
        ['a model name shorter than two characters', 'P/1'],
        ['a model name breaking the model name pattern', 'Project$DM/1'],
    ])('should reject %s', (_, notADocRefString) => {
        expect(isDocumentReferenceString(notADocRefString)).toBe(false);
    });
});
