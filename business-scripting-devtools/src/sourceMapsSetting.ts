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


const SOURCE_MAPS_FLAG = "--source-maps";
const SOURCE_MAPS_FLAG_ASSIGNMENT = `${SOURCE_MAPS_FLAG}=`;

/** The accepted values of the source-map setting, in the order an error message lists them. */
export const SOURCE_MAPS_SETTINGS = ["inline", "off"] as const;

/**
 * Whether the built scripts carry an inline source map.
 *
 * With `"inline"` a script failure reports the location in the TypeScript source and a debugger
 * steps through it, at the price of the map naming the source paths it was built from. With `"off"`
 * no map is emitted at all.
 */
export type SourceMapsSetting = (typeof SOURCE_MAPS_SETTINGS)[number];

export function isSourceMapsSetting(setting: unknown): setting is SourceMapsSetting {
  return SOURCE_MAPS_SETTINGS.some((acceptedSetting) => acceptedSetting === setting);
}

/** The accepted values as an error message names them. */
export function describeAcceptedSourceMapsSettings(): string {
  return SOURCE_MAPS_SETTINGS.map((setting) => `"${setting}"`).join(" and ");
}

/**
 * Reads the setting from the command line, so a production build is one flag away from the
 * development one instead of needing its own build script. Absent without the flag.
 *
 * Anything but an accepted value is rejected, the flag without a value included — falling back to
 * the default there would silently keep the source maps a production build asked to switch off.
 */
export function readSourceMapsSettingFromCommandLine(): SourceMapsSetting | undefined {
  const flag = process.argv.find(
    (argument) => argument === SOURCE_MAPS_FLAG || argument.startsWith(SOURCE_MAPS_FLAG_ASSIGNMENT)
  );
  if (flag === undefined) {
    return undefined;
  }
  const value = flag.substring(SOURCE_MAPS_FLAG_ASSIGNMENT.length);
  if (!isSourceMapsSetting(value)) {
    throw new Error(
      `unknown ${SOURCE_MAPS_FLAG} value "${value}" — pass it as ${SOURCE_MAPS_FLAG_ASSIGNMENT}<value>, ` +
      `where <value> is one of ${describeAcceptedSourceMapsSettings()}`
    );
  }
  return value;
}
