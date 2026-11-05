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

import {readFileSync} from "fs";
import {resolve} from "path";

import type {Plugin} from "esbuild";

import {toForwardSlashes} from "./forwardSlashes.js";
import {declaresEntryFunction} from "./regex.js";

const DEFAULT_SOURCE_DIR = "./src";
const NODE_MODULES_SEGMENT = "/node_modules/";

/**
 * Returns a plugin that prevents esbuild from tree-shaking the entry-point script function.
 *
 * Without an export, esbuild treats the function as dead code in ESM format and removes
 * it from the bundle. This plugin injects a named export for the entry function
 * before bundling so esbuild keeps it.
 *
 * Only processes `.ts` files under one of `sourceDirs`. Files outside all of them are passed
 * through to esbuild's default loader unchanged; one that declares an entry function is warned
 * about, because that is how an entry point placed outside the configured directories would
 * otherwise vanish from its own bundle. Ordinary modules the scripts import stay silent.
 *
 * Usage: `plugins: [createKeepEntryFunctionPlugin(["./first-scripts/src", "./second-scripts/src"])]`
 *
 * @param sourceDirs Directories containing script entry points. Relative paths are resolved
 *   against the current working directory at build time, not when this function is called.
 */
export function createKeepEntryFunctionPlugin(sourceDirs: string[]): Plugin {
  return {
    name: "keep-entry-function",
    setup(build) {
      // Resolved per build (not at plugin creation) so each esbuild run picks up the current cwd.
      const resolvedSourceDirs = sourceDirs.map((sourceDir) => toForwardSlashes(resolve(sourceDir)));
      build.onLoad({ filter: /\.ts$/ }, (args) => {
        const normalizedPath = toForwardSlashes(args.path);
        if (!resolvedSourceDirs.some((sourceDir) => normalizedPath.startsWith(sourceDir + "/"))) {
          warnIfEntryPointOutsideSourceDirs(args.path, normalizedPath, resolvedSourceDirs);
          return null;
        }
        const tsSource = readFileSync(args.path, "utf-8");
        // A helper module the scripts import passes through here too. Appending the export to one
        // would fail the build with "No matching export", so only a script gets it.
        if (!declaresEntryFunction(tsSource)) {
          return null;
        }
        return {
          contents: tsSource + `\nexport { execute };\n`,
          loader: "ts",
        };
      });
    },
  };
}

/**
 * Warns only when a file outside every configured source directory declares an entry function, which
 * makes it a script that was probably meant to be built — its export would be tree-shaken away. A
 * module without an entry function is an ordinary import with nothing to protect, so it stays silent;
 * warning about those would make every build noisy no matter where such a module is placed.
 */
function warnIfEntryPointOutsideSourceDirs(path: string, normalizedPath: string, resolvedSourceDirs: string[]): void {
  if (normalizedPath.includes(NODE_MODULES_SEGMENT)) {
    return;
  }
  if (!declaresEntryFunction(readFileSync(path, "utf-8"))) {
    return;
  }
  console.warn(
    `[keep-entry-function] ${path} declares an entry function but lies outside every configured ` +
    `script directory (${resolvedSourceDirs.join(", ")}).\n` +
    `  It is bundled without a protected export — esbuild will tree-shake the entry function and\n` +
    `  the bundle will contain nothing callable.\n` +
    `  Move it into one of those directories, or add its directory to the build configuration.`
  );
}

/**
 * Entry-function protection plugin for the conventional single-directory layout — equivalent to
 * `createKeepEntryFunctionPlugin(["./src"])`. Use the factory when scripts live in several directories.
 */
export const keepEntryFunctionPlugin: Plugin = createKeepEntryFunctionPlugin([DEFAULT_SOURCE_DIR]);
