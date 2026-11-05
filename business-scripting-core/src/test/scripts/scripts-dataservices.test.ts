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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {ServerConnector} from '@com.mgmtp.a12.utils/utils-connector';

import {executionContext, TestContext} from '../../api/execution-contexts.js';
import {A12} from '../../api/facades';
import {DocumentReference} from "../../api/document-reference.js";

import {TEST_AUTHORIZATION_HEADER} from '../test-helpers.js';

const mockCallRpc = vi.hoisted(() => vi.fn());

vi.mock('../../internal/rpc.js', () => ({
    callRpc: mockCallRpc,
}));

const mockConnector: ServerConnector = { fetchData: vi.fn() };

const DOCUMENT_MODEL_NAME = 'Project_DM';
const FIRST_DOCUMENT_ID = '1';
const SECOND_DOCUMENT_ID = '2';

describe('A12.Scripts.call in TestContext with targetContext: dataServices', () => {
    beforeEach(() => {
        (executionContext as TestContext).init(mockConnector, TEST_AUTHORIZATION_HEADER);
        mockCallRpc.mockClear();
    });

    afterEach(() => {
        (executionContext as TestContext).reset();
    });

    it('should route to dataServices when targetContext is explicitly dataServices', async () => {
        // given
        const expected = { invoiceId: '42' };
        mockCallRpc.mockResolvedValueOnce(expected);

        // when
        const result = await A12.Scripts.call('createInvoice', { orderRef: 'O-1' }, { targetContext: 'dataServices' });

        // then
        expect(mockCallRpc).toHaveBeenCalledWith(mockConnector, 'CALL_SCRIPT', {
            scriptName: 'createInvoice',
            arguments: { orderRef: 'O-1' },
        });
        expect(result).toEqual(expected);
    });

    it('should convert array of bare docRef strings to DocumentReference instances', async () => {
        // given
        // A12 2026.06 serializes a DocumentReference as the bare string "documentModelName/documentId"
        mockCallRpc.mockResolvedValueOnce({
            createdDocRefs: [`${DOCUMENT_MODEL_NAME}/${FIRST_DOCUMENT_ID}`, `${DOCUMENT_MODEL_NAME}/${SECOND_DOCUMENT_ID}`],
        });

        // when
        const result = await A12.Scripts.call<{ createdDocRefs: DocumentReference[] }>('createDocs', {}, { targetContext: 'dataServices'});

        // then
        expect(result.createdDocRefs[0]).toEqual(new DocumentReference(DOCUMENT_MODEL_NAME, FIRST_DOCUMENT_ID));
        expect(result.createdDocRefs[1]).toEqual(new DocumentReference(DOCUMENT_MODEL_NAME, SECOND_DOCUMENT_ID));
    });

});
