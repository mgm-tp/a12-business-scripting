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

import {readFileSync} from 'node:fs';

import {AuthenticationError} from '../api/errors.js';
import {API_KEY_FILE_ENV_VAR} from '../internal/constants.js';

/** Wire format of A12 UAA's `API_KEY` authentication, as produced by `UAACertificateTokenAcquirer`. */
const AUTHORIZATION_SCHEME = 'APIKey';

/**
 * Builds the `Authorization` header value that authenticates the test framework against A12 services,
 * from the X.509 certificate file named by `A12_SCRIPTING_TESTING_API_KEY_FILE`.
 *
 * The file's bytes are base64-encoded verbatim, so PEM and DER files both work.
 *
 * @throws {AuthenticationError} If the environment variable is unset or the file cannot be read.
 */
export function buildAuthorizationHeaderFromCertificateFile(): string {
    const certificatePath = process.env[API_KEY_FILE_ENV_VAR];
    if (!certificatePath) {
        throw new AuthenticationError('No certificate file is configured.');
    }

    return `${AUTHORIZATION_SCHEME} ${readCertificateAsBase64(certificatePath)}`;
}

function readCertificateAsBase64(certificatePath: string): string {
    try {
        return readFileSync(certificatePath).toString('base64');
    } catch {
        throw new AuthenticationError('The configured certificate file could not be read.');
    }
}
