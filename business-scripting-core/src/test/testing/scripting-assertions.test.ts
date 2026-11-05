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

import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as chai from 'chai';

import * as ReadWrite from '../../api/facades/documents/read-write.js';
import {DocumentReference} from '../../api/document-reference.js';
import {scriptingAssertions} from '../../testing/scripting-assertions.js';

vi.mock('../../api/facades/documents/read-write.js');

describe('scriptingAssertions', () => {
    beforeEach(() => {
        chai.use(scriptingAssertions);
        vi.resetAllMocks();
    });

    describe('fieldValue', () => {
        const docRef = new DocumentReference('SomeModel_DM', 'doc-1');

        it('should pass when field value matches expected', async () => {
            // given
            vi.mocked(ReadWrite.read).mockResolvedValue('expectedValue');

            // when / then
            await expect(chai.expect(docRef).fieldValue('/Project/Name', 'expectedValue')).resolves.toBeUndefined();
        });

        it('should fail when field value does not match expected', async () => {
            // given
            vi.mocked(ReadWrite.read).mockResolvedValue('actualValue');

            // when / then
            await expect(chai.expect(docRef).fieldValue('/Project/Name', 'expectedValue')).rejects.toThrow('/Project/Name');
        });
    });

    describe('model', () => {
        it('should pass when documentModelName matches', () => {
            // given
            const docRef = new DocumentReference('SomeModel_DM', 'doc-1');

            // when / then
            expect(() => chai.expect(docRef).model('SomeModel_DM')).not.toThrow();
        });

        it('should fail when documentModelName does not match', () => {
            // given
            const docRef = new DocumentReference('OtherModel_DM', 'doc-1');

            // when / then
            expect(() => chai.expect(docRef).model('SomeModel_DM')).toThrow();
        });
    });

    describe('documentReference', () => {
        it('should pass for a DocumentReference', () => {
            expect(() => chai.expect(new DocumentReference('SomeModel_DM', 'doc-1')).documentReference).not.toThrow();
        });

        it('should fail for an object that only carries the two docRef fields', () => {
            // given
            // The shape a docRef takes when a call path serializes it field by field instead of as a
            // "documentModelName/documentId" string. Accepting it would hide a missing conversion.
            const beanSerializedDocRef = { documentModelName: 'SomeModel_DM', documentId: 'doc-1' };

            // when / then
            expect(() => chai.expect(beanSerializedDocRef).documentReference).toThrow('DocumentReference');
        });

        it('should fail for a docRef string', () => {
            expect(() => chai.expect('SomeModel_DM/doc-1').documentReference).toThrow('DocumentReference');
        });

        it.each([
            ['a plain object', { name: 'not a ref' }],
            ['undefined', undefined],
            ['null', null],
        ])('should fail for %s', (_, notADocRef) => {
            expect(() => chai.expect(notADocRef).documentReference).toThrow('DocumentReference');
        });
    });
});
