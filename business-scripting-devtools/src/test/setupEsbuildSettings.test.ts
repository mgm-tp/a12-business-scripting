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

import type {FSWatcher} from "fs";

import type {BuildContext, BuildOptions} from "esbuild";
import {context as esbuildContext} from "esbuild";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {discoverEntryPointGroups, discoverEntryPoints} from "../entryPoints.js";
import {setupEsbuild, type SetupEsbuildOptions} from "../esbuild.js";
import {warnAboutLibraryLevel} from "../typeCheckerLibraries.js";
import {watchWithDebounce} from "../watch.js";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, rmSync: vi.fn(), existsSync: vi.fn().mockReturnValue(true), readdirSync: vi.fn().mockReturnValue(["old-script.js"]) };
});

vi.mock("../entryPoints.js", () => ({
  discoverEntryPoints: vi.fn(),
  discoverEntryPointGroups: vi.fn(),
}));

vi.mock("../watch.js", () => ({
  watchWithDebounce: vi.fn(),
}));

vi.mock("esbuild", () => ({
  context: vi.fn(),
}));

vi.mock("../unusedSources.js", () => ({
  warnAboutUnusedSourceFiles: vi.fn(),
}));

vi.mock("../typeCheckerLibraries.js", () => ({
  warnAboutLibraryLevel: vi.fn().mockResolvedValue(undefined),
}));

const SOURCE_DIR = "./src";
const BUILD_DIR = "./build";
const FIRST_SCRIPT_ROOT = "./first-scripts/src";
const SECOND_SCRIPT_ROOT = "./second-scripts/src";
const BOTH_SCRIPT_ROOTS = [FIRST_SCRIPT_ROOT, SECOND_SCRIPT_ROOT];
const TYPE_CHECK_COMMAND = "npm run typecheck";
const TYPE_CHECK_PLUGIN_NAME = "type-check";
const REBUILD_RESULT = { metafile: { inputs: {}, outputs: {} } };
const ENTRY_POINT = { in: "src/a.ts", out: "a" };
const FIRST_GROUP_ENTRY_POINT = { in: "first-scripts/src/first-script.ts", out: "first-script" };
const SECOND_GROUP_ENTRY_POINT = { in: "second-scripts/src/second-script.ts", out: "second-script" };

function esbuildContextOptions(): BuildOptions[] {
  return vi.mocked(esbuildContext).mock.calls.map((call) => call[0]);
}

function pluginNamesOf(contextOptions: BuildOptions): string[] {
  return (contextOptions.plugins ?? []).map((plugin) => plugin.name);
}

function mockGroupsOfBothScriptRoots(): void {
  vi.mocked(discoverEntryPointGroups).mockReturnValue([
    { sourceDirectory: FIRST_SCRIPT_ROOT, outputSubdirectory: "first-scripts", entryPoints: [FIRST_GROUP_ENTRY_POINT] },
    { sourceDirectory: SECOND_SCRIPT_ROOT, outputSubdirectory: "second-scripts", entryPoints: [SECOND_GROUP_ENTRY_POINT] },
  ]);
}

describe("setupEsbuild settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockCtx = {
      rebuild: vi.fn().mockResolvedValue(REBUILD_RESULT),
      dispose: vi.fn().mockResolvedValue(undefined),
      watch: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(esbuildContext).mockResolvedValue(mockCtx as unknown as BuildContext);
    vi.mocked(discoverEntryPoints).mockReturnValue([ENTRY_POINT]);
    vi.mocked(discoverEntryPointGroups).mockReturnValue([
      { sourceDirectory: SOURCE_DIR, outputSubdirectory: "", entryPoints: [ENTRY_POINT] },
    ]);
    vi.mocked(watchWithDebounce).mockReturnValue({ close: vi.fn() } as unknown as FSWatcher);
  });
  it("should throw when buildDir is outside cwd", async () => {
    // when / then
    await expect(setupEsbuild(SOURCE_DIR, "..")).rejects.toThrow("unsafe buildDir");
  });

  it("should throw when a bare boolean is passed where the options object is expected", async () => {
    // given — the third parameter used to be the watch flag, so a stale call must not build silently
    const staleWatchFlag = true as unknown as SetupEsbuildOptions;

    // when / then
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, staleWatchFlag)).rejects.toThrow("options object");
  });

  it("should throw when a setting of the options object is not a boolean", async () => {
    // given — a string would be truthy and switch splitting on where the caller switched it off
    const stringInsteadOfBoolean = { splitting: "false" } as unknown as SetupEsbuildOptions;

    // when / then
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, stringInsteadOfBoolean))
      .rejects.toThrow("splitting (boolean)");
  });

  it("should throw naming the accepted values when the source-map setting is unknown", async () => {
    // given — a typo must not silently fall back to emitting maps in a production build
    const misspelledSetting = { sourceMaps: "none" } as unknown as SetupEsbuildOptions;

    // when / then
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, misspelledSetting))
      .rejects.toThrow('sourceMaps ("inline" and "off")');
  });

  it("should throw when the production setting is not a boolean", async () => {
    // given — a string would be truthy and build for a deployment where the caller switched it off
    const stringInsteadOfBoolean = { production: "false" } as unknown as SetupEsbuildOptions;

    // when / then
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, stringInsteadOfBoolean))
      .rejects.toThrow("production (boolean)");
  });

  it("should throw naming a setting the options object does not know", async () => {
    // given — a misspelled key would be ignored and keep the maps in a production build
    const misspelledKey = { production: true, sourceMap: "off" } as unknown as SetupEsbuildOptions;

    // when / then
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, misspelledKey))
      .rejects.toThrow('unknown setting(s) "sourceMap"');
  });

  it("should throw when the type-check command is not a string", async () => {
    // given — a boolean here would build unchecked where the caller asked for a check
    const commandAsBoolean = { typeCheckCommand: true } as unknown as SetupEsbuildOptions;

    // when / then
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, commandAsBoolean))
      .rejects.toThrow("typeCheckCommand (string)");
  });

  it("should register the type check with every output group when a command is given", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false, typeCheckCommand: TYPE_CHECK_COMMAND });

    // then — a group left unchecked would build a script that does not type-check
    expect(esbuildContextOptions()).toHaveLength(2);
    for (const contextOptions of esbuildContextOptions()) {
      expect(pluginNamesOf(contextOptions)).toContain(TYPE_CHECK_PLUGIN_NAME);
    }
  });

  it("should check the type check's library level once per build, however many output groups it has", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false, typeCheckCommand: TYPE_CHECK_COMMAND });

    // then
    expect(warnAboutLibraryLevel).toHaveBeenCalledOnce();
  });

  it("should not check the library level without a type-check command", async () => {
    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then — without a type check there is no library level to report on
    expect(warnAboutLibraryLevel).not.toHaveBeenCalled();
  });

  it("should register no type check without a command", async () => {
    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then — the setting is absent by default, so an existing consumer builds as it did
    expect(pluginNamesOf(esbuildContextOptions()[0]!)).not.toContain(TYPE_CHECK_PLUGIN_NAME);
  });
});
