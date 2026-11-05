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
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {discoverEntryPointGroups, discoverEntryPoints} from "../entryPoints.js";
import {setupEsbuild} from "../esbuild.js";
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

const SOURCE_DIR = "./src";
const BUILD_DIR = "./build";
const ENTRY_POINT = { in: "src/a.ts", out: "a" };

function esbuildContextOptions(): BuildOptions[] {
  return vi.mocked(esbuildContext).mock.calls.map((call) => call[0]);
}

describe("setupEsbuild", () => {
  let mockCtx: { rebuild: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; watch: ReturnType<typeof vi.fn> };
  const originalCommandLineArguments = process.argv;

  /** Runs the build as if it had been started with these arguments, the way an npm script does. */
  function withCommandLineArguments(...commandLineArguments: string[]): void {
    process.argv = ["node", "esbuild.build.js", ...commandLineArguments];
  }

  afterEach(() => {
    process.argv = originalCommandLineArguments;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      rebuild: vi.fn().mockResolvedValue({ metafile: { inputs: {}, outputs: {} } }),
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

  const INLINE_SOURCE_MAP_OPTIONS = { sourcemap: "inline", sourcesContent: false };

  function firstContextOptions(): BuildOptions {
    return esbuildContextOptions()[0]!;
  }

  describe("source maps", () => {
    it("should emit an inline source map without the source text by default", async () => {
      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

      // then — the map resolves a failure to its TypeScript line; the source text stays out of it
      expect(firstContextOptions()).toMatchObject(INLINE_SOURCE_MAP_OPTIONS);
    });

    it("should emit no source map at all when they are switched off", async () => {
      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, sourceMaps: "off" });

      // then — a map switched off must not leave sourcesContent behind either
      expect(firstContextOptions().sourcemap).toBeUndefined();
      expect(firstContextOptions().sourcesContent).toBeUndefined();
    });

    it("should take the setting from the command line when the caller gives none", async () => {
      // given — this is how a production build is run without its own build script
      withCommandLineArguments("--source-maps=off");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

      // then
      expect(firstContextOptions().sourcemap).toBeUndefined();
    });

    it("should let an explicit setting win over the command line", async () => {
      // given
      withCommandLineArguments("--source-maps=off");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, sourceMaps: "inline" });

      // then
      expect(firstContextOptions()).toMatchObject(INLINE_SOURCE_MAP_OPTIONS);
    });

    it("should honour the watch flag and the source-map flag given together", async () => {
      // given
      withCommandLineArguments("--watch", "--source-maps=off");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR);

      // then
      expect(firstContextOptions().sourcemap).toBeUndefined();
      expect(mockCtx.watch).toHaveBeenCalledOnce();
    });

    it("should throw naming the accepted values when the command line asks for an unknown setting", async () => {
      // given
      withCommandLineArguments("--source-maps=none");

      // when / then
      await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false }))
        .rejects.toThrow('unknown --source-maps value "none" — pass it as --source-maps=<value>');
    });

    it("should reject the flag given without a value instead of falling back to the default", async () => {
      // given — a dropped "=off" would otherwise leave the maps on in a production build, silently
      withCommandLineArguments("--source-maps");

      // when / then
      await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false }))
        .rejects.toThrow("pass it as --source-maps=<value>");
    });

    it("should reject an unknown command-line setting even where an explicit setting wins", async () => {
      // given — silently ignoring the typo would hide it until the flag is the only setting there is
      withCommandLineArguments("--source-maps=none");

      // when / then
      await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, sourceMaps: "off" }))
        .rejects.toThrow('unknown --source-maps value "none"');
    });
  });

  describe("production preset", () => {
    it("should switch the source maps off under the preset", async () => {
      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, production: true });

      // then
      expect(firstContextOptions().sourcemap).toBeUndefined();
    });

    it("should take the preset from the command line when the caller gives none", async () => {
      // given — this is what the build.production npm script runs
      withCommandLineArguments("--production");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

      // then
      expect(firstContextOptions().sourcemap).toBeUndefined();
    });

    it("should let an explicit source-map setting win over the preset", async () => {
      // given — a deployment that asserts script locations reproduces a production build with maps
      withCommandLineArguments("--production");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, sourceMaps: "inline" });

      // then
      expect(firstContextOptions()).toMatchObject(INLINE_SOURCE_MAP_OPTIONS);
    });

    it("should let the source-map flag win over the preset flag", async () => {
      // given
      withCommandLineArguments("--production", "--source-maps=inline");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false });

      // then
      expect(firstContextOptions()).toMatchObject(INLINE_SOURCE_MAP_OPTIONS);
    });

    it("should let an explicit production setting win over the command line", async () => {
      // given
      withCommandLineArguments("--production");

      // when
      await setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, production: false });

      // then
      expect(firstContextOptions()).toMatchObject(INLINE_SOURCE_MAP_OPTIONS);
    });

    it("should reject the preset flag given with a value instead of building for development", async () => {
      // given — "--production=true" is not "--production", so it would otherwise keep the maps, silently
      withCommandLineArguments("--production=true");

      // when / then
      await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false }))
        .rejects.toThrow('unknown argument "--production=true" — pass the preset as --production, without a value');
    });

    it("should reject the preset flag given with a value even where an explicit production setting wins", async () => {
      // given
      withCommandLineArguments("--production=false");

      // when / then
      await expect(setupEsbuild(SOURCE_DIR, BUILD_DIR, { watch: false, production: false }))
        .rejects.toThrow('unknown argument "--production=false"');
    });
  });
});
