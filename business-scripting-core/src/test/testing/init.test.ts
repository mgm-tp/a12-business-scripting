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

import {describe, expect, it, vi} from 'vitest';

import type {TestContext} from '../../api/execution-contexts.js';
import {UNINITIALIZED_TEST_CONTEXT_MESSAGE} from '../../internal/constants.js';

import {TEST_AUTHORIZATION_HEADER} from '../test-helpers.js';

describe('initTestContext', () => {
    const RPC_URL = 'http://localhost:8092/api/v2/rpc';

    it(`should init executionContext with a RestServerConnector for the given url`, async () => {
        // given
        const {executionContext} = await import('../../api/execution-contexts.js');
        const initSpy = vi.spyOn(executionContext as TestContext, 'init');

        // when
        const {initTestContext} = await import('../../testing/init.js');
        initTestContext(RPC_URL, TEST_AUTHORIZATION_HEADER);

        // then
        expect(initSpy).toHaveBeenCalledOnce();
        const connector = initSpy.mock.calls[0]![0]!;
        expect(connector.getBaseUrl()).toBe(RPC_URL);
        expect(initSpy.mock.calls[0]![1]).toBe(TEST_AUTHORIZATION_HEADER);
    });

    it('should make the authorization header available to the clients', async () => {
        // given
        const {executionContext} = await import('../../api/execution-contexts.js');
        const testContext = executionContext as TestContext;

        // when
        const {initTestContext} = await import('../../testing/init.js');
        initTestContext(RPC_URL, TEST_AUTHORIZATION_HEADER);

        // then
        expect(testContext.authorizationHeader()).toBe(TEST_AUTHORIZATION_HEADER);
    });

    it('should fail when the authorization header is requested before init', async () => {
        // given
        const {executionContext} = await import('../../api/execution-contexts.js');
        const testContext = executionContext as TestContext;
        testContext.reset();

        // when / then
        expect(() => testContext.authorizationHeader()).toThrowError(UNINITIALIZED_TEST_CONTEXT_MESSAGE);
    });
});
