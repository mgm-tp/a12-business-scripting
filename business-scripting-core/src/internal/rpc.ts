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

import { RestRequestPayload, ServerConnector } from '@com.mgmtp.a12.utils/utils-connector';

import { RpcError } from "../api/errors.js";
import { executionContext, isTestContext } from '../api/execution-contexts.js';

import { RPC_URL_ENV_VAR } from './constants.js';
import { throwIfCredentialRejected } from './credential-rejection.js';

/** Protocol version sent in every JSON-RPC request. */
const JSONRPC_VERSION = '2.0';

/** Monotonically increasing counter used to generate unique JSON-RPC request ids. */
let requestIdCounter = 0;

/**
 * Error shape thrown by `ServerConnector.fetchData` for all non-2xx responses.
 * The `DefaultErrorResponseFilter` intercepts every non-ok response and rejects
 * with this shape, so a `Response` object is never returned for error status codes.
 */
interface ConnectorError {
	/** HTTP status code reported by the connector. */
	status: number;
	/** Optional response body provided by the connector. */
	content?: unknown;
	/** URL that was requested, if available. */
	url?: string;
}

/** Type guard that narrows an unknown thrown value to {@link ConnectorError}. */
function isConnectorError(err: unknown): err is ConnectorError {
	return typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number';
}

function readRpcUrl(): string {
	const rpcUrl = process.env[RPC_URL_ENV_VAR];
	if (!rpcUrl) {
		throw new Error(
			`Missing required environment variable: ${RPC_URL_ENV_VAR}. Configure it in your .env file (see .env.example).`,
		);
	}
	return rpcUrl;
}

/**
 * Returns the `Authorization` header value the test context was initialised with.
 *
 * @throws {RpcError} Outside a `TestContext`.
 */
function readAuthorizationHeader(): string {
	if (!isTestContext(executionContext)) {
		throw new RpcError('Direct RPC calls are only supported in TestContext');
	}
	return executionContext.authorizationHeader();
}

/**
 * Wraps `connector.fetchData` and casts the result to `Response`.
 *
 * The double cast (`as unknown as Response`) is required because
 * `fetchData` is typed to return a connector-internal type rather than
 * the standard Fetch API `Response`, even though it resolves to one at runtime.
 */
async function fetchResponse(connector: ServerConnector, payload: RestRequestPayload): Promise<Response> {
    // await is needed. This is a TS mistake in ServerConnector typing
	return (await connector.fetchData(payload)) as unknown as Response;
}

/** One method call of a JSON-RPC 2.0 batch. */
export interface RpcCall {
	/** JSON-RPC method name. */
	method: string;
	/** Named parameters forwarded in the JSON-RPC request. */
	params: Record<string, unknown>;
}

/** A JSON-RPC 2.0 request object as sent on the wire. */
interface RpcRequest extends RpcCall {
	jsonrpc: typeof JSONRPC_VERSION;
	id: string;
}

function toRpcRequest(call: RpcCall): RpcRequest {
	return { jsonrpc: JSONRPC_VERSION, method: call.method, id: String(++requestIdCounter), params: call.params };
}

/**
 * Sends a JSON-RPC 2.0 request and returns the `result` field of the response.
 *
 * Authenticates with the certificate credential the test context holds. That credential is static,
 * so a rejected request is never retried — re-sending the same header cannot succeed.
 *
 * @param connector - Connector used to perform the HTTP request.
 * @param method - JSON-RPC method name.
 * @param params - Named parameters forwarded in the JSON-RPC request body.
 * @throws {Error} On non-2xx HTTP status, JSON-RPC `error` in the response body, or parse failure.
 */
export async function callRpc(
	connector: ServerConnector,
	method: string,
	params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const response = await postRpcBody(connector, method, toRpcRequest({ method, params }));
	const elements = await readRpcResponseElementsOrThrow(method, response);
	throwOnAnyElementError(method, elements);
	return parseRpcResult(elements.find((element) => element.result != null)?.result);
}

/**
 * Sends the calls as one JSON-RPC 2.0 batch request and returns their results in the order of the calls.
 *
 * DataServices runs a batch in one transaction, so an error in any call means none of them took effect.
 * It answers the calls one after another in request order, so the failing call's error comes before the
 * errors it reports for the calls it then skipped. Authentication works as in {@link callRpc}.
 *
 * @throws {Error} On non-2xx HTTP status, a JSON-RPC `error` for any call, a missing response element, or parse failure.
 */
export async function callRpcBatch(connector: ServerConnector, calls: RpcCall[]): Promise<Record<string, unknown>[]> {
	if (calls.length === 0) {
		return [];
	}
	const methodNamesForErrors = [...new Set(calls.map((call) => call.method))].join(', ');
	const requests = calls.map(toRpcRequest);
	const response = await postRpcBody(connector, methodNamesForErrors, requests);
	const elements = await readRpcResponseElementsOrThrow(methodNamesForErrors, response);
	throwOnAnyElementError(methodNamesForErrors, elements);
	return requests.map((request) => parseRpcResult(findResponseElementOrThrow(methodNamesForErrors, elements, request.id).result));
}

function findResponseElementOrThrow(methodNamesForErrors: string, elements: RpcResponseElement[], requestId: string): RpcResponseElement {
	const element = elements.find((candidate) => candidate.id === requestId);
	if (!element) {
		throw new RpcError(`${methodNamesForErrors}: response has no element for request ${requestId}`);
	}
	return element;
}

/** Posts the request body with the test context's credential; throws when the credential or the request is rejected. */
async function postRpcBody(connector: ServerConnector, methodNamesForErrors: string, body: RpcRequest | RpcRequest[]): Promise<Response> {
	const rpcUrl = readRpcUrl();
	const authorizationHeader = readAuthorizationHeader();

	let response: Response;
	try {
		response = await fetchResponse(connector, {
			relativeUrl: '',
			runtimeBaseUrl: rpcUrl,
			method: 'POST',
			body: JSON.stringify(body),
			customHeaders: [
				['Content-Type', 'application/json'],
				['Authorization', authorizationHeader],
				['Accept-Language', 'en'],
			],
		});
	} catch (err) {
		if (isConnectorError(err)) {
			throwIfCredentialRejected(err.status);
			throw new RpcError(`${methodNamesForErrors} returned error: ${JSON.stringify(err.content)}`);
		}
		throw err;
	}

	throwIfCredentialRejected(response.status);
	return response;
}

/** Shape of a single JSON-RPC 2.0 response element. */
interface RpcResponseElement {
	id?: string | null;
	result?: unknown;
	error?: unknown;
}

/**
 * Reads the elements of a JSON-RPC 2.0 HTTP response; a single object becomes a one-element list.
 *
 * Throws on non-2xx HTTP status or JSON parse failure.
 */
async function readRpcResponseElementsOrThrow(methodNamesForErrors: string, response: Response): Promise<RpcResponseElement[]> {
	if (!response.ok) {
		const errorBody = await response.text();
		throw new RpcError(`${methodNamesForErrors} failed: ${response.status} ${response.statusText} — ${errorBody}`);
	}

	const json = await response
		.json()
		.catch(() => { throw new RpcError(`${methodNamesForErrors}: failed to parse response as JSON`); }) as
		RpcResponseElement | RpcResponseElement[];

	return Array.isArray(json) ? json : [json];
}

/**
 * Throws an RpcError listing every JSON-RPC `error` in the response elements, in their order.
 *
 * DataServices defers constraint checks (e.g. duplicate links, upper limits) to transaction
 * commit and reports their failures as an additional element in an array response body.
 * Such deferred errors mean the whole request was rolled back, so any element containing
 * an `error` fails the call.
 */
function throwOnAnyElementError(methodNamesForErrors: string, elements: RpcResponseElement[]): void {
	const errors = elements.map((element) => element.error).filter(Boolean);
	if (errors.length > 0) {
		throw new RpcError(`${methodNamesForErrors} returned error: ${errors.map((error) => JSON.stringify(error)).join(', ')}`);
	}
}

function parseRpcResult(raw: unknown): Record<string, unknown> {
	const result = raw ?? {};
	return (typeof result === 'string' ? JSON.parse(result) : result) as Record<string, unknown>;
}
