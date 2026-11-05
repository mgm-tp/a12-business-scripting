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
import {readdirSync, rmSync} from "fs";

import type {BuildContext, BuildOptions} from "esbuild";
import {context as esbuildContext} from "esbuild";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {discoverEntryPointGroups, discoverEntryPoints} from "../entryPoints.js";
import {setupEsbuild} from "../esbuild.js";
import {warnAboutUnusedSourceFiles} from "../unusedSources.js";
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
const FIRST_OUTPUT_SUBDIRECTORY = "first-scripts";
const SECOND_OUTPUT_SUBDIRECTORY = "second-scripts";
const DUPLICATE_SCRIPT_BASENAME = "duplicate-script";
const SAME_LABEL_FIRST_SCRIPT_ROOT = "./teamA/scripts/src";
const SAME_LABEL_SECOND_SCRIPT_ROOT = "./teamB/scripts/src";
const SHARED_OUTPUT_SUBDIRECTORY = "scripts";
const SHARED_CHUNK_NAME_TEMPLATE = "shared-lib-[hash]";
const PINNED_SYNTAX_TARGET = "es2025";
const ENGINE_PLATFORM = "neutral";
const PACKAGE_ENTRY_FIELDS = ["module", "main"];
const REBUILD_RESULT = { metafile: { inputs: {}, outputs: {} } };
const FIRST_GROUP_ENTRY_POINT = { in: "first-scripts/src/first-script.ts", out: "first-script" };
const SECOND_GROUP_ENTRY_POINT = { in: "second-scripts/src/second-script.ts", out: "second-script" };

function esbuildContextOptions(): BuildOptions[] {
  return vi.mocked(esbuildContext).mock.calls.map((call) => call[0]);
}

describe("setupEsbuild", () => {
  let mockCtx: { rebuild: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; watch: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      rebuild: vi.fn().mockResolvedValue(REBUILD_RESULT),
      dispose: vi.fn().mockResolvedValue(undefined),
      watch: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(esbuildContext).mockResolvedValue(mockCtx as unknown as BuildContext);
    vi.mocked(discoverEntryPoints).mockReturnValue([{ in: "src/a.ts", out: "a" }]);
    vi.mocked(discoverEntryPointGroups).mockReturnValue([
      { sourceDirectory: SOURCE_DIR, outputSubdirectory: "", entryPoints: [{ in: "src/a.ts", out: "a" }] },
    ]);
    vi.mocked(watchWithDebounce).mockReturnValue({ close: vi.fn() } as unknown as FSWatcher);
  });

  function mockGroupsOfBothScriptRoots(): void {
    vi.mocked(discoverEntryPointGroups).mockReturnValue([
      { sourceDirectory: FIRST_SCRIPT_ROOT, outputSubdirectory: FIRST_OUTPUT_SUBDIRECTORY, entryPoints: [FIRST_GROUP_ENTRY_POINT] },
      { sourceDirectory: SECOND_SCRIPT_ROOT, outputSubdirectory: SECOND_OUTPUT_SUBDIRECTORY, entryPoints: [SECOND_GROUP_ENTRY_POINT] },
    ]);
  }

  it("should clean buildDir, rebuild, then dispose in non-watch mode", async () => {
    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then
    expect(readdirSync).toHaveBeenCalledWith(BUILD_DIR);
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("old-script.js"), { recursive: true, force: true });
    expect(mockCtx.rebuild).toHaveBeenCalledOnce();
    expect(mockCtx.dispose).toHaveBeenCalledOnce();
    expect(mockCtx.watch).not.toHaveBeenCalled();
    expect(watchWithDebounce).not.toHaveBeenCalled();
  });

  it("should clean buildDir, rebuild, then start watching in watch mode", async () => {
    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: true });

    // then
    expect(readdirSync).toHaveBeenCalledWith(BUILD_DIR);
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("old-script.js"), { recursive: true, force: true });
    expect(mockCtx.rebuild).toHaveBeenCalledOnce();
    expect(mockCtx.watch).toHaveBeenCalledOnce();
    expect(mockCtx.dispose).not.toHaveBeenCalled();
    expect(watchWithDebounce).toHaveBeenCalledOnce();
    expect(watchWithDebounce).toHaveBeenCalledWith(SOURCE_DIR, expect.any(Function), expect.any(Number));
  });

  it("should start watching when the initial build fails in watch mode", async () => {
    // given — a script that does not compile or type-check fails the build; the next edit may fix it
    mockCtx.rebuild.mockRejectedValue(new Error("Build failed with 1 error:\nerror: type check failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: true });

    // then
    expect(mockCtx.watch).toHaveBeenCalledOnce();
    expect(mockCtx.dispose).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]![0])).toContain("failed to rebuild 1 of 1 output group(s)");
    expect(warnAboutUnusedSourceFiles).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("should fail and dispose the build context when the build fails in non-watch mode", async () => {
    // given
    mockCtx.rebuild.mockRejectedValue(new Error("Build failed with 1 error"));

    // when / then — a one-off build has no later edit to wait for
    await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false })).rejects.toThrow("Build failed with 1 error");
    expect(mockCtx.watch).not.toHaveBeenCalled();
    // An open esbuild context keeps the Node process alive.
    expect(mockCtx.dispose).toHaveBeenCalledOnce();
  });

  it("should split shared code into a chunk the runtime recognises by its name prefix by default", async () => {
    // when — no splitting option, so the recommended default applies
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then — without these two options every script inlines the whole business-scripting-core
    expect(esbuildContextOptions()[0]).toMatchObject({
      splitting: true,
      chunkNames: SHARED_CHUNK_NAME_TEMPLATE,
      format: "esm",
    });
  });

  it("should inline the shared code into every script when splitting is switched off", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false, splitting: false });

    // then — a chunk name template without splitting would only rename esbuild's other output files
    expect(esbuildContextOptions()).toHaveLength(2);
    for (const contextOptions of esbuildContextOptions()) {
      expect(contextOptions.splitting).toBe(false);
      expect(contextOptions.chunkNames).toBeUndefined();
    }
  });

  it("should pin the syntax level to what the script engine can parse", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false });

    // then — an unpinned target emits whatever the installed esbuild considers current
    expect(esbuildContextOptions()).toHaveLength(2);
    for (const contextOptions of esbuildContextOptions()) {
      expect(contextOptions.target).toBe(PINNED_SYNTAX_TARGET);
    }
  });

  it("should build for the script engine's own platform, resolving packages by their module entry first", async () => {
    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then — esbuild's default platform would resolve a package's browser variant, which the engine cannot run
    expect(esbuildContextOptions()[0]).toMatchObject({ platform: ENGINE_PLATFORM, mainFields: PACKAGE_ENTRY_FIELDS });
  });

  it("should report the source files of every configured directory that reached no script", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false });

    // then — the check needs every configured directory, otherwise a whole group looks unused
    expect(warnAboutUnusedSourceFiles).toHaveBeenCalledWith(BOTH_SCRIPT_ROOTS, [REBUILD_RESULT, REBUILD_RESULT]);
  });

  it("should build a single source directory in one context writing straight to buildDir", async () => {
    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then — an unprefixed group must not add a directory level to the output
    expect(esbuildContext).toHaveBeenCalledOnce();
    expect(esbuildContextOptions()[0]).toMatchObject({ outdir: BUILD_DIR });
  });

  it("should build each output group in its own context writing into its own subdirectory", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false });

    // then — the per-group outdir is what puts each group's chunk next to the scripts importing it
    expect(discoverEntryPointGroups).toHaveBeenCalledWith(BOTH_SCRIPT_ROOTS);
    expect(esbuildContext).toHaveBeenCalledTimes(2);
    expect(esbuildContextOptions()[0]).toMatchObject({
      entryPoints: [FIRST_GROUP_ENTRY_POINT],
      outdir: `build/${FIRST_OUTPUT_SUBDIRECTORY}`,
      splitting: true,
      chunkNames: SHARED_CHUNK_NAME_TEMPLATE,
    });
    expect(esbuildContextOptions()[1]).toMatchObject({
      entryPoints: [SECOND_GROUP_ENTRY_POINT],
      outdir: `build/${SECOND_OUTPUT_SUBDIRECTORY}`,
      splitting: true,
      chunkNames: SHARED_CHUNK_NAME_TEMPLATE,
    });
  });

  it("should clean buildDir exactly once for all output groups", async () => {
    // given — cleaning per group would delete the previously built groups
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false });

    // then
    expect(readdirSync).toHaveBeenCalledOnce();
    expect(readdirSync).toHaveBeenCalledWith(BUILD_DIR);
  });

  it("should rebuild and dispose every output group's context", async () => {
    // given
    mockGroupsOfBothScriptRoots();

    // when
    await setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false });

    // then — both contexts are the same mock, so one call per group
    expect(mockCtx.rebuild).toHaveBeenCalledTimes(2);
    expect(mockCtx.dispose).toHaveBeenCalledTimes(2);
  });

  it("should throw when two source directories contain a script of the same name", async () => {
    // given — runtime registers scripts by filename alone, so one would silently shadow the other
    const duplicateInFirstRoot = `first-scripts/src/${DUPLICATE_SCRIPT_BASENAME}.ts`;
    const duplicateInSecondRoot = `second-scripts/src/${DUPLICATE_SCRIPT_BASENAME}.ts`;
    vi.mocked(discoverEntryPointGroups).mockReturnValue([
      {
        sourceDirectory: FIRST_SCRIPT_ROOT,
        outputSubdirectory: FIRST_OUTPUT_SUBDIRECTORY,
        entryPoints: [{ in: duplicateInFirstRoot, out: DUPLICATE_SCRIPT_BASENAME }],
      },
      {
        sourceDirectory: SECOND_SCRIPT_ROOT,
        outputSubdirectory: SECOND_OUTPUT_SUBDIRECTORY,
        entryPoints: [{ in: duplicateInSecondRoot, out: DUPLICATE_SCRIPT_BASENAME }],
      },
    ]);

    // when
    const buildingBothRoots = setupEsbuild(BOTH_SCRIPT_ROOTS, BUILD_DIR, { watch: false });

    // then — the message must name the clashing script and both offending sources
    await expect(buildingBothRoots).rejects.toThrow(DUPLICATE_SCRIPT_BASENAME);
    await expect(buildingBothRoots).rejects.toThrow(duplicateInFirstRoot);
    await expect(buildingBothRoots).rejects.toThrow(duplicateInSecondRoot);
  });

  it("should throw when two source directories resolve to the same output subdirectory", async () => {
    // given — both are named "src" below a "scripts" directory, so both groups derive the label "scripts"
    vi.mocked(discoverEntryPointGroups).mockReturnValue([
      {
        sourceDirectory: SAME_LABEL_FIRST_SCRIPT_ROOT,
        outputSubdirectory: SHARED_OUTPUT_SUBDIRECTORY,
        entryPoints: [FIRST_GROUP_ENTRY_POINT],
      },
      {
        sourceDirectory: SAME_LABEL_SECOND_SCRIPT_ROOT,
        outputSubdirectory: SHARED_OUTPUT_SUBDIRECTORY,
        entryPoints: [SECOND_GROUP_ENTRY_POINT],
      },
    ]);

    // when — two contexts writing to one outdir would overwrite each other's scripts and chunks
    const buildingBothRoots = setupEsbuild(
      [SAME_LABEL_FIRST_SCRIPT_ROOT, SAME_LABEL_SECOND_SCRIPT_ROOT],
      BUILD_DIR,
      { watch: false }
    );

    // then — the message must name the clashing subdirectory and both offending source directories
    await expect(buildingBothRoots).rejects.toThrow(SHARED_OUTPUT_SUBDIRECTORY);
    await expect(buildingBothRoots).rejects.toThrow(SAME_LABEL_FIRST_SCRIPT_ROOT);
    await expect(buildingBothRoots).rejects.toThrow(SAME_LABEL_SECOND_SCRIPT_ROOT);
    expect(esbuildContext).not.toHaveBeenCalled();
  });

  it("should clean buildDir before rebuild", async () => {
    // given
    const callOrder: string[] = [];
    vi.mocked(readdirSync).mockImplementation(
      (() => { callOrder.push("cleanBuildDir"); return ["old-script.js"]; }) as unknown as typeof readdirSync
    );
    mockCtx.rebuild.mockImplementation(async () => { callOrder.push("rebuild"); return REBUILD_RESULT; });

    // when
    await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

    // then
    expect(callOrder).toEqual(["cleanBuildDir", "rebuild"]);
  });
});
