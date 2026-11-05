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

import { FSWatcher, watch } from "fs";

/**
 * Watches `sourceDir` recursively for `.ts` file changes and calls `callback` after
 * `debounceMs` milliseconds of inactivity. `.d.ts` files and non-TypeScript files are ignored.
 * Returns the underlying `FSWatcher` so the caller can close it when done; closing it also cancels
 * a callback still pending for a change reported before.
 *
 * @example
 * import {
 *   watchWithDebounce,
 *   discoverEntryPoints,
 *   injectScriptMetadata,
 *   stripNodeModulesFromSourceMaps,
 * } from "@com.mgmtp.a12.scripting/business-scripting-devtools"
 *
 * const watcher = watchWithDebounce("./src", async () => {
 *   const entryPoints = discoverEntryPoints("./src")
 *   await runMyBundler(entryPoints)
 *   injectScriptMetadata({ buildDir: "./build", entryPoints })
 *   stripNodeModulesFromSourceMaps("./build")
 * }, 200)
 */
export function watchWithDebounce(
  sourceDir: string,
  callback: () => void | Promise<void>,
  debounceMs: number,
): FSWatcher {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const watcher = watch(sourceDir, { recursive: true }, (_, filename) => {
    if (filename == null || !filename.endsWith(".ts") || filename.endsWith(".d.ts")) {
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { void callback(); }, debounceMs);
  });
  watcher.on("close", () => clearTimeout(debounceTimer));
  return watcher;
}
