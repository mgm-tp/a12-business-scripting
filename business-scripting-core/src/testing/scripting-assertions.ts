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

import { DocumentReference } from '../api/document-reference.js';
import { read } from '../api/facades/documents/read-write.js';

declare global {
    namespace Chai {
        interface Assertion {
            fieldValue(fieldPath: string, expected: unknown): Promise<void>;
            model(modelName: string): void;
            documentReference: void;
        }
    }
}

export function scriptingAssertions(chai: Chai.ChaiStatic): void {
    chai.Assertion.addMethod('fieldValue', async function (fieldPath: string, expected: unknown) {
        const ref = this._obj as DocumentReference;
        const actual = await read(new DocumentReference(ref.documentModelName, ref.documentId), fieldPath);
        this.assert(
            actual === expected,
            `Expected field "${fieldPath}" to equal #{exp} but got #{act}`,
            `Expected field "${fieldPath}" not to equal #{exp}`,
            expected,
            actual,
        );
    });

    chai.Assertion.addMethod('model', function (modelName: string) {
        const ref = this._obj as DocumentReference;
        this.assert(
            ref.documentModelName === modelName,
            `Expected model #{exp} but got #{act}`,
            `Expected model not to be #{exp}`,
            modelName,
            ref.documentModelName,
        );
    });

    // Checks the type, not the two fields: an object carrying documentModelName and documentId is what
    // an unconverted docRef looks like, and accepting it would hide exactly that defect.
    chai.Assertion.addProperty('documentReference', function () {
        this.assert(
            this._obj instanceof DocumentReference,
            `Expected #{act} to be a DocumentReference`,
            `Expected #{act} not to be a DocumentReference`,
        );
    });
}
