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

import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {AuthenticationError} from '../../api/errors.js';
import {API_KEY_FILE_ENV_VAR} from '../../internal/constants.js';
import {buildAuthorizationHeaderFromCertificateFile} from '../../testing/api-key-credential.js';

const PEM_CERTIFICATE = '-----BEGIN CERTIFICATE-----\nMIIBmarker\n-----END CERTIFICATE-----\n';
const DER_CERTIFICATE = Uint8Array.from([0x30, 0x82, 0x01, 0x66, 0x00, 0xff, 0xfe, 0x0a]);

describe('buildAuthorizationHeaderFromCertificateFile', () => {
    let certificateDirectory: string;

    function writeConfiguredCertificate(contents: string | Uint8Array): void {
        const certificatePath = join(certificateDirectory, 'client.crt');
        writeFileSync(certificatePath, contents);
        vi.stubEnv(API_KEY_FILE_ENV_VAR, certificatePath);
    }

    beforeEach(() => {
        certificateDirectory = mkdtempSync(join(tmpdir(), 'api-key-credential-'));
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        rmSync(certificateDirectory, {recursive: true, force: true});
    });

    it('should base64-encode a PEM certificate file behind the APIKey prefix', () => {
        // given
        writeConfiguredCertificate(PEM_CERTIFICATE);

        // when
        const authorizationHeader = buildAuthorizationHeaderFromCertificateFile();

        // then
        expect(authorizationHeader).toBe(`APIKey ${Buffer.from(PEM_CERTIFICATE).toString('base64')}`);
    });

    it('should base64-encode a DER certificate file byte for byte', () => {
        // given
        writeConfiguredCertificate(DER_CERTIFICATE);

        // when
        const authorizationHeader = buildAuthorizationHeaderFromCertificateFile();

        // then
        expect(authorizationHeader).toBe(`APIKey ${Buffer.from(DER_CERTIFICATE).toString('base64')}`);
    });

    it('should fail with an authentication error naming the environment variable when it is not set', () => {
        // given
        vi.stubEnv(API_KEY_FILE_ENV_VAR, undefined);

        // when / then
        expect(() => buildAuthorizationHeaderFromCertificateFile()).toThrowError(AuthenticationError);
        expect(() => buildAuthorizationHeaderFromCertificateFile()).toThrowError(API_KEY_FILE_ENV_VAR);
    });

    it('should fail naming the environment variable but not the path when the file cannot be read', () => {
        // given
        const missingPath = join(certificateDirectory, 'absent.crt');
        vi.stubEnv(API_KEY_FILE_ENV_VAR, missingPath);

        // when / then
        expect(() => buildAuthorizationHeaderFromCertificateFile()).toThrowError(AuthenticationError);
        expect(() => buildAuthorizationHeaderFromCertificateFile()).toThrowError(API_KEY_FILE_ENV_VAR);
        expect(() => buildAuthorizationHeaderFromCertificateFile()).not.toThrowError(missingPath);
    });
});
