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

import {describe, expectTypeOf, it} from 'vitest';

import { DocumentReference } from '../api/document-reference.js';
import { create, getOrFail, modify } from '../api/facades/documents/index.js';
import * as Links from '../api/facades/links.js';
import { SimpleList } from '../api/simple-list.js';
import { DocumentV2 } from '../graaljs-compat-typings/index.js';

const docRef = {} as DocumentReference;
const docRefs = [] as DocumentReference[];

describe(`Document.getOrFail()`, () => {
    it('getOrFail(docRef) has return type DocumentV2', () => {
        expectTypeOf(getOrFail(docRef)).toEqualTypeOf<Promise<DocumentV2>>();
    })

    it('getOrFail(docRefs) has return type SimpleList<DocumentV2>', () => {
        expectTypeOf(getOrFail(docRefs)).toEqualTypeOf<Promise<SimpleList<DocumentV2>>>();
    })
})

describe('Plain object inputs', () => {
    const linkDescriptor = {
        relationshipModelName: 'Project_Employee_RM',
        sourceRole: 'Project',
        sourceDocRef: docRef,
        targetRole: 'Employee',
        targetDocRef: docRef,
    };

    it('should accept a plain object as document data in Documents.create', () => {
        expectTypeOf(create).toBeCallableWith('Project_DM', { Project: { Name: 'A12' } });
    })

    it('should accept a plain object as document data in Documents.modify', () => {
        expectTypeOf(modify).toBeCallableWith(docRef, { Project: { Name: 'A12' } });
    })

    it('should accept a plain object as link document in Links.create', () => {
        expectTypeOf(Links.create).toBeCallableWith(linkDescriptor, { Assignment: { Allocation: 50 } });
    })
})
