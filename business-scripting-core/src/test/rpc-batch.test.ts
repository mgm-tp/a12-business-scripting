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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerConnector } from '@com.mgmtp.a12.utils/utils-connector';

import { executionContext, TestContext } from '../api/execution-contexts.js';
import { callRpcBatch } from '../internal/rpc.js';

import { JSONRPC_VERSION, mockConnector, mockResponse, useRpcTestEnvironment } from './rpc-test-helpers.js';
import { TEST_AUTHORIZATION_HEADER } from './test-helpers.js';

useRpcTestEnvironment();

type RpcRequestBody = { jsonrpc: string; id: string; method: string; params: Record<string, unknown> };

type ResponseOrder = 'requestOrder' | 'reversed';

/**
 * Connector that answers a batch request with one response element per request,
 * built by `respond` from the request's id and position. DataServices answers in request order;
 * a reversed response shows that results are matched to their calls by id rather than by position.
 */
function mockBatchConnector(respond: (request: RpcRequestBody, index: number) => object, responseOrder: ResponseOrder) {
	const fetchData = vi.fn()
		.mockImplementationOnce((payload: { body: string }) => {
			const requests = JSON.parse(payload.body) as RpcRequestBody[];
			const elements = requests.map((request, index) => ({ jsonrpc: JSONRPC_VERSION, id: request.id, ...respond(request, index) }));
			return Promise.resolve(mockResponse({ json: responseOrder === 'reversed' ? elements.reverse() : elements }));
		});
	return { fetchData } as ServerConnector & { fetchData: typeof fetchData };
}

const DELETE_LINK = 'DELETE_LINK';
const FIRST_LINK_REF = { linkRef: { id: 'link-1' } };
const SECOND_LINK_REF = { linkRef: { id: 'link-2' } };
const WRONG_ENTITY_ERROR = { code: -32015, message: 'Wrong Entity', data: { description: { default: 'Requested link [link-1] has role:docRef' } } };
const PREVIOUS_OPERATION_FAILED_ERROR = { code: -32603, message: 'Previous operation failed', data: { description: { default: 'Previous operation failed' } } };

describe('callRpcBatch', () => {
	beforeEach(() => {
		(executionContext as TestContext).init(mockConnector(), TEST_AUTHORIZATION_HEADER);
	});

	it('should send all calls in one JSON-RPC array request', async () => {
		// given
		const connector = mockBatchConnector(() => ({ result: {} }), 'requestOrder');

		// when
		await callRpcBatch(connector, [
			{ method: DELETE_LINK, params: FIRST_LINK_REF },
			{ method: DELETE_LINK, params: SECOND_LINK_REF },
		]);

		// then
		expect(connector.fetchData).toHaveBeenCalledOnce();
		const rpcCall = connector.fetchData.mock.calls[0]![0] as { body: string };
		const requests = JSON.parse(rpcCall.body) as RpcRequestBody[];
		expect(requests).toMatchObject([
			{ jsonrpc: JSONRPC_VERSION, method: DELETE_LINK, params: FIRST_LINK_REF },
			{ jsonrpc: JSONRPC_VERSION, method: DELETE_LINK, params: SECOND_LINK_REF },
		]);
		expect(new Set(requests.map((request) => request.id)).size).toBe(2);
	});

	it('should return the results in the order of the calls', async () => {
		// given
		const connector = mockBatchConnector((_request, index) => ({ result: { position: index } }), 'reversed');

		// when
		const results = await callRpcBatch(connector, [
			{ method: DELETE_LINK, params: FIRST_LINK_REF },
			{ method: DELETE_LINK, params: SECOND_LINK_REF },
		]);

		// then
		expect(results).toEqual([{ position: 0 }, { position: 1 }]);
	});

	it('should throw with the errors in response order, so the failing call comes first', async () => {
		// given - DataServices fails the first call and reports the second one as skipped
		const connector = mockBatchConnector((_request, index) =>
			({ error: index === 0 ? WRONG_ENTITY_ERROR : PREVIOUS_OPERATION_FAILED_ERROR }), 'requestOrder');

		// when / then
		await expect(callRpcBatch(connector, [
			{ method: DELETE_LINK, params: FIRST_LINK_REF },
			{ method: DELETE_LINK, params: SECOND_LINK_REF },
		])).rejects.toThrow(
			`${DELETE_LINK} returned error: ${JSON.stringify(WRONG_ENTITY_ERROR)}, ${JSON.stringify(PREVIOUS_OPERATION_FAILED_ERROR)}`,
		);
	});

	it('should throw when the response has no element for a call', async () => {
		// given
		const connector = mockConnector(mockResponse({ json: [] }));

		// when / then
		await expect(callRpcBatch(connector, [{ method: DELETE_LINK, params: FIRST_LINK_REF }]))
			.rejects.toThrow(`${DELETE_LINK}: response has no element for request`);
	});

	it('should send no request for an empty list of calls', async () => {
		// given
		const connector = mockConnector();

		// when
		const results = await callRpcBatch(connector, []);

		// then
		expect(results).toEqual([]);
		expect(connector.fetchData).not.toHaveBeenCalled();
	});
});
