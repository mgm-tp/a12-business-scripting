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

import type { FSWatcher } from "fs";
import { writeFileSync } from "fs";
import { join } from "path";

import { context as esbuildContext } from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupEsbuild } from "../esbuild.js";
import { watchWithDebounce } from "../watch.js";

import {
  createWorkspace,
  FIRST_SOURCE_DIR_NAME,
  HELPER_FILE,
  HELPER_SOURCE,
  listBuiltFiles,
  readBuiltFile,
  removeCreatedWorkspaces,
  SCRIPT_FILE,
  scriptImportingFromHelper,
} from "./esbuildIntegrationFixtures.js";

// Real esbuild and real file watchers, recorded only so every context and watcher can be closed again.
vi.mock("esbuild", async (importOriginal) => {
  const actual = await importOriginal<typeof import("esbuild")>();
  return { ...actual, context: vi.fn(actual.context) };
});

vi.mock("../watch.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../watch.js")>();
  return { ...actual, watchWithDebounce: vi.fn(actual.watchWithDebounce) };
});

/**
 * Real-esbuild watch sessions over temporary source directories, driven by editing the files the way
 * a scripter does: what reaches the build directory after an edit.
 */

const BUILT_SCRIPT_FILE = "script.js";
const LATER_SCRIPT_FILE = "later.ts";
const BUILT_LATER_SCRIPT_FILE = "later.js";
const STANDALONE_SCRIPT_SOURCE = 'function execute(): string {\n  return "hi";\n}\n';
const HELPER_SOURCE_AFTER_EDIT = HELPER_SOURCE.replace("toUpperCase", "toLowerCase");
const MODULE_WITHOUT_ENTRY_FUNCTION = "export const later = 1;\n";
const MODULE_WITH_ENTRY_FUNCTION = 'function execute(): string {\n  return "later";\n}\n';
/** Outlasts the watcher's debounce, esbuild's rebuild delay and its polling of the files it read. */
const REBUILD_TIMEOUT_MS = 10_000;
const REBUILD_POLL_INTERVAL_MS = 100;
const WATCH_TEST_TIMEOUT_MS = 20_000;

let warnSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(async () => {
  await closeEveryWatchSession();
  warnSpy.mockRestore();
  logSpy.mockRestore();
  removeCreatedWorkspaces();
});

/**
 * Stops what the watch session started. Closing the watchers cancels any recreation still pending,
 * but one already running must finish before its contexts are disposed and its workspace deleted —
 * otherwise it finds no source directory and exits.
 */
async function closeEveryWatchSession(): Promise<void> {
  vi.mocked(watchWithDebounce).mock.results
    .forEach((watcherResult) => (watcherResult.value as FSWatcher).close());
  // Each watcher's callback chains onto the recreations before it, so awaiting it awaits them all.
  await Promise.all(vi.mocked(watchWithDebounce).mock.calls
    .map(([, recreateContextIfEntryPointsChanged]) => recreateContextIfEntryPointsChanged()));
  const createdContexts = await Promise.all(vi.mocked(esbuildContext).mock.results.map((contextResult) => contextResult.value));
  await Promise.all(createdContexts.map((createdContext) => createdContext.dispose()));
}

function waitForRebuild(assertion: () => void): Promise<void> {
  return vi.waitFor(assertion, { timeout: REBUILD_TIMEOUT_MS, interval: REBUILD_POLL_INTERVAL_MS });
}

describe("setupEsbuild in watch mode", () => {
  it("should update the output of a script importing a helper once the helper is edited", async () => {
    // given
    const workspace = createWorkspace({
      [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: scriptImportingFromHelper("./helper.js"), [HELPER_FILE]: HELPER_SOURCE },
    });
    await setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: true });
    expect(readBuiltFile(workspace.buildDir, BUILT_SCRIPT_FILE)).toContain("toUpperCase");

    // when
    writeFileSync(join(workspace.sourceDirs[0]!, HELPER_FILE), HELPER_SOURCE_AFTER_EDIT);

    // then — esbuild's own watch rebuilds the importer; the script set did not change, so no new context
    await waitForRebuild(() => expect(readBuiltFile(workspace.buildDir, BUILT_SCRIPT_FILE)).toContain("toLowerCase"));
    expect(esbuildContext).toHaveBeenCalledOnce();
  }, WATCH_TEST_TIMEOUT_MS);

  it("should build a module as a script once it gains an entry function", async () => {
    // given — a module without an entry function is a helper, which produces no output of its own
    const workspace = createWorkspace({
      [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: STANDALONE_SCRIPT_SOURCE, [LATER_SCRIPT_FILE]: MODULE_WITHOUT_ENTRY_FUNCTION },
    });
    await setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: true });
    expect(listBuiltFiles(workspace.buildDir)).toEqual([BUILT_SCRIPT_FILE]);

    // when
    writeFileSync(join(workspace.sourceDirs[0]!, LATER_SCRIPT_FILE), MODULE_WITH_ENTRY_FUNCTION);

    // then — esbuild cannot add an entry point to a running context, so the session recreates it
    await waitForRebuild(() => expect(listBuiltFiles(workspace.buildDir)).toEqual([BUILT_LATER_SCRIPT_FILE, BUILT_SCRIPT_FILE]));
    expect(esbuildContext).toHaveBeenCalledTimes(2);
  }, WATCH_TEST_TIMEOUT_MS);
});
