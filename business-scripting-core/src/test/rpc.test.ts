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

import { AuthenticationError, RpcError } from '../api/errors.js';
import { executionContext, TestContext } from '../api/execution-contexts.js';
import { API_KEY_FILE_ENV_VAR, RPC_URL_ENV_VAR } from '../internal/constants.js';
import { callRpc } from '../internal/rpc.js';

import {
	HTTP_OK_STATUS,
	HTTP_OK_STATUS_TEXT,
	JSONRPC_VERSION,
	TEST_RPC_URL,
	mockConnector,
	mockResponse,
	useRpcTestEnvironment,
} from './rpc-test-helpers.js';
import { TEST_AUTHORIZATION_HEADER } from './test-helpers.js';


const TEST_DM = "Test_DM"
const mockDocRef = { docRef: `${TEST_DM}/123`}
const mockDocument = { id: `${TEST_DM}/123`, documentModelId: TEST_DM }

const HTTP_UNAUTHORIZED_STATUS = 401;
const HTTP_FORBIDDEN_STATUS = 403;
const RPC_REQUEST_ID = '1';

useRpcTestEnvironment();

const rpcSuccess = (result: unknown) => mockResponse({ json: { jsonrpc: JSONRPC_VERSION, id: RPC_REQUEST_ID, result } });

describe('callRpc', () => {
	beforeEach(() => {
		(executionContext as TestContext).init(mockConnector(), TEST_AUTHORIZATION_HEADER);
	});

	it('should return result on success', async () => {
		// given
		const connector = mockConnector(rpcSuccess(mockDocRef));

		// when
		const result = await callRpc(connector, 'ADD_DOCUMENT', { documentModelName: TEST_DM });

		// then
		expect(result).toEqual(mockDocRef);
	});

	it('should send RPC request to RPC URL from env with the certificate authorization header', async () => {
		// given
		const connector = mockConnector(rpcSuccess({}));
		const params = { documentModelName: TEST_DM };

		// when
		await callRpc(connector, 'ADD_DOCUMENT', params);

		// then
		expect(connector.fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				runtimeBaseUrl: TEST_RPC_URL,
				method: 'POST',
				customHeaders: expect.arrayContaining([
					['Content-Type', 'application/json'],
					['Authorization', TEST_AUTHORIZATION_HEADER],
					['Accept-Language', 'en'],
				]),
			}),
		);
        // check if request body contains the correct values
		const rpcCall = connector.fetchData.mock.calls[0]![0] as { body: string };
		expect(JSON.parse(rpcCall.body)).toMatchObject({ jsonrpc: JSONRPC_VERSION, method: 'ADD_DOCUMENT', params });
        // request body contains a numeric id
		expect(JSON.parse(rpcCall.body).id).toMatch(/^\d+$/);
	});

	it('should send exactly one request per call with the credential attached', async () => {
		// given
		const connector = mockConnector(rpcSuccess({}), rpcSuccess({}));

		// when
		await callRpc(connector, 'GET_DOCUMENT', { docRef: `${TEST_DM}/1` });
		await callRpc(connector, 'GET_DOCUMENT', { docRef: `${TEST_DM}/2` });

		// then — the credential travels on the RPC request itself, so no call costs a second round trip
		expect(connector.fetchData).toHaveBeenCalledTimes(2);
		for (const [payload] of connector.fetchData.mock.calls) {
			expect((payload as { runtimeBaseUrl: string }).runtimeBaseUrl).toBe(TEST_RPC_URL);
		}
	});

	it('should report a credential the server rejected as an authentication failure', async () => {
		// given
		const connector = mockConnector(
			mockResponse({ ok: false, status: HTTP_UNAUTHORIZED_STATUS, statusText: 'Unauthorized', text: '' }),
		);

		// when
		const error = await callRpc(connector, 'GET_DOCUMENT', {}).catch((thrown: unknown) => thrown);

		// then
		expect(error).toBeInstanceOf(AuthenticationError);
		expect(error).not.toBeInstanceOf(RpcError);
		expect((error as AuthenticationError).message).toContain(API_KEY_FILE_ENV_VAR);
	});

	it('should report a missing right as the failure the deployment described, not as an authentication failure', async () => {
		// given — the credential authenticated here, so pointing the scripter at the certificate would mislead
		const connector = mockConnector(
			mockResponse({
				ok: false,
				status: HTTP_FORBIDDEN_STATUS,
				statusText: 'Forbidden',
				text: 'Missing right DOCUMENT_READ',
			}),
		);

		// when
		const error = await callRpc(connector, 'GET_DOCUMENT', {}).catch((thrown: unknown) => thrown);

		// then
		expect(error).toBeInstanceOf(RpcError);
		expect(error).not.toBeInstanceOf(AuthenticationError);
		expect((error as RpcError).message).toContain('Missing right DOCUMENT_READ');
	});

	it('should report a credential the connector rejected as an authentication failure', async () => {
		// given
		const fetchData = vi.fn().mockRejectedValueOnce({ status: HTTP_UNAUTHORIZED_STATUS, content: 'unauthorized' });
		const connector = { fetchData } as unknown as ServerConnector;

		// when/then
		await expect(callRpc(connector, 'GET_DOCUMENT', {})).rejects.toBeInstanceOf(AuthenticationError);
	});

	it('should never name the credential in an authentication failure', async () => {
		// given
		const credentialBase64 = TEST_AUTHORIZATION_HEADER.split(' ')[1]!;
		const connector = mockConnector(
			mockResponse({ ok: false, status: HTTP_UNAUTHORIZED_STATUS, statusText: 'Unauthorized', text: '' }),
		);

		// when
		const error = await callRpc(connector, 'GET_DOCUMENT', {}).catch((thrown: unknown) => thrown as Error);

		// then
		expect(error.message).not.toContain(credentialBase64);
		expect(error.message).not.toContain(credentialBase64.slice(0, 8));
		expect(error.message).not.toContain(String(credentialBase64.length));
	});

	it('should throw when RPC HTTP request fails', async () => {
		// given
		const connector = mockConnector(
			mockResponse({ ok: false, status: 500, statusText: 'Internal Server Error', text: 'server error' }),
		);

		// when/then
		await expect(callRpc(connector, 'ADD_DOCUMENT', {})).rejects.toThrow('ADD_DOCUMENT');
	});

	it('should throw when RPC response contains error', async () => {
		// given
		const connector = mockConnector(
			mockResponse({ json: { jsonrpc: JSONRPC_VERSION, id: RPC_REQUEST_ID, error: { code: -32000, message: 'Model not found' } } }),
		);

		// when/then
		await expect(callRpc(connector, 'ADD_DOCUMENT', {})).rejects.toThrow('ADD_DOCUMENT');
	});

	it('should throw when array response contains a deferred error', async () => {
		// given — DS defers constraint checks (e.g. duplicate links) to transaction commit and
		// responds with an array: the operation result plus a separate error element.
		const deferredError = { code: -32024, message: 'Duplicated link constraint violated' };
		const connector = mockConnector(
			mockResponse({
				json: [
					{ jsonrpc: JSONRPC_VERSION, id: RPC_REQUEST_ID, result: { id: 'link-1' } },
					{ jsonrpc: JSONRPC_VERSION, id: null, error: deferredError },
				],
			}),
		);

		// when/then
		await expect(callRpc(connector, 'ADD_LINK', {})).rejects.toThrow('Duplicated link constraint violated');
	});

	it('should return the result element when array response contains no error', async () => {
		// given
		const connector = mockConnector(
			mockResponse({ json: [{ jsonrpc: JSONRPC_VERSION, id: RPC_REQUEST_ID, result: mockDocRef }] }),
		);

		// when
		const result = await callRpc(connector, 'ADD_LINK', {});

		// then
		expect(result).toEqual(mockDocRef);
	});

	it('should throw when RPC response body is not valid JSON', async () => {
		const brokenResponse = {
			ok: true,
			status: HTTP_OK_STATUS,
			statusText: HTTP_OK_STATUS_TEXT,
			headers: { get: () => null },
			json: () => Promise.reject(new SyntaxError('Unexpected token')),
			text: () => Promise.resolve(''),
		} as unknown as Response;
		const connector = mockConnector(brokenResponse);
		await expect(callRpc(connector, 'ADD_DOCUMENT', {})).rejects.toThrow('parse response as JSON');
	});

	it('should return empty object when RPC result is null', async () => {
		const connector = mockConnector(mockResponse({ json: { jsonrpc: JSONRPC_VERSION, id: RPC_REQUEST_ID, result: null } }));
		const result = await callRpc(connector, 'DELETE_DOCUMENT', mockDocRef);
		expect(result).toEqual({});
	});

	it('should throw naming the missing environment variable', async () => {
		// given
		vi.stubEnv(RPC_URL_ENV_VAR, '');
		const connector = mockConnector();

		// when/then
		await expect(callRpc(connector, 'ADD_DOCUMENT', {})).rejects.toThrow(RPC_URL_ENV_VAR);

		vi.unstubAllEnvs();
	});

	it('should parse result when RPC returns a JSON-encoded string', async () => {
		// given
		const connector = mockConnector(rpcSuccess(JSON.stringify(mockDocument)));

		// when
		const result = await callRpc(connector, 'GET_DOCUMENT', mockDocRef);

		// then
		expect(result).toEqual(mockDocument);
	});

	it('should throw when RPC connector throws a non-401 ConnectorError', async () => {
		// given
		const fetchData = vi.fn().mockRejectedValueOnce({ status: 503, content: 'service unavailable' });
		const connector = { fetchData } as unknown as ServerConnector;

		// when/then
		await expect(callRpc(connector, 'ADD_DOCUMENT', {})).rejects.toThrow('ADD_DOCUMENT');
	});
});
