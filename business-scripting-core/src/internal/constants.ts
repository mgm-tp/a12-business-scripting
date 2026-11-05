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

export const PAGE_SIZE_LIMIT = 100
export const FIRST_PAGE = 0

/** Names the X.509 certificate file the test framework authenticates with. */
export const API_KEY_FILE_ENV_VAR = 'A12_SCRIPTING_TESTING_API_KEY_FILE'

/** Names the Data Services JSON-RPC endpoint the test framework calls. */
export const RPC_URL_ENV_VAR = 'A12_SCRIPTING_TESTING_DATA_SERVICES_URL'

/** Message thrown by every `TestContext` accessor that is used before `init`. */
export const UNINITIALIZED_TEST_CONTEXT_MESSAGE = 'TestContext requires calling init() before use'
