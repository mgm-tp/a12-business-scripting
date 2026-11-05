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

import { beforeAll, vi } from 'vitest';

import { ServerConnector } from '@com.mgmtp.a12.utils/utils-connector';

import { RPC_URL_ENV_VAR } from '../internal/constants.js';

export const TEST_RPC_URL = 'http://rpc-server:8082/api/v2/rpc';

export const HTTP_OK_STATUS = 200;
export const HTTP_OK_STATUS_TEXT = 'OK';
export const JSONRPC_VERSION = '2.0';

/** Registers a beforeAll hook that points the RPC client at the test RPC URL. */
export function useRpcTestEnvironment(): void {
	beforeAll(() => {
		process.env[RPC_URL_ENV_VAR] = TEST_RPC_URL;
	});
}

export function mockResponse(params: {
	ok?: boolean;
	status?: number;
	statusText?: string;
	json?: unknown;
	text?: string;
}): Response {
	const { ok = true, status = HTTP_OK_STATUS, statusText = HTTP_OK_STATUS_TEXT, json, text = '' } = params;
	return {
		ok,
		status,
		statusText,
		headers: { get: () => null },
		json: () => Promise.resolve(json),
		text: () => Promise.resolve(text),
	} as unknown as Response;
}

/** Connector that answers its requests with the given responses, in order. */
export function mockConnector(...responses: Response[]): ServerConnector & { fetchData: ReturnType<typeof vi.fn> } {
	let call = 0;
	return { fetchData: vi.fn(() => Promise.resolve(responses[call++])) };
}
