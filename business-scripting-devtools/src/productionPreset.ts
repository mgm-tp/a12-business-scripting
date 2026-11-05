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

import { type SourceMapsSetting } from "./sourceMapsSetting.js";

const PRODUCTION_FLAG = "--production";

/**
 * What `production: true` selects for every setting it covers: the value each takes under the preset
 * unless it is set explicitly, in the options or by its own command-line flag. A setting listed here
 * is one a deployment must not inherit from the development loop.
 */
export const PRODUCTION_PRESET: { readonly sourceMaps: SourceMapsSetting } = {
  sourceMaps: "off",
};

/**
 * Whether the build was started with `--production`, the way a `build.production` npm script does.
 *
 * The flag given with a value, such as `--production=true`, is rejected: it is not the flag, so it
 * would otherwise build for development and keep the source maps a production build switches off.
 */
export function readProductionFlagFromCommandLine(): boolean {
  const flagWithValue = process.argv.find((argument) => argument.startsWith(`${PRODUCTION_FLAG}=`));
  if (flagWithValue !== undefined) {
    throw new Error(`unknown argument "${flagWithValue}" — pass the preset as ${PRODUCTION_FLAG}, without a value`);
  }
  return process.argv.includes(PRODUCTION_FLAG);
}
