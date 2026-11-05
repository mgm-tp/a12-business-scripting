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

import { mkdtempSync, rmSync } from "fs";
import { join, resolve } from "path";
import type { FSWatcher } from "fs";

import type { BuildContext } from "esbuild";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { discoverEntryPoints } from "../entryPoints.js";
import { watchEsbuild } from "../esbuild.js";
import { watchWithDebounce } from "../watch.js";

const DEBOUNCE_MS = 100;
const SOURCE_DIR = "./src";
const ENTRY_POINT_A = { in: "src/a.ts", out: "a" };
const ENTRY_POINT_B = { in: "src/b.ts", out: "b" };

vi.mock("../watch.js", () => ({
  watchWithDebounce: vi.fn(),
}));
vi.mock("../entryPoints.js", () => ({
  discoverEntryPoints: vi.fn(),
}));
vi.mock("../unusedSources.js", () => ({
  warnAboutUnusedSourceFiles: vi.fn(),
}));

describe("watchEsbuild", () => {
  let buildDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    buildDir = mkdtempSync(join(resolve("."), "devtools-watchEsbuild-test-"));
  });

  afterEach(() => {
    rmSync(buildDir, { recursive: true, force: true });
  });
  describe("with several source directories", () => {
    const FIRST_SCRIPT_ROOT = "./first-scripts/src";
    const SECOND_SCRIPT_ROOT = "./second-scripts/src";
    const BOTH_SCRIPT_ROOTS = [FIRST_SCRIPT_ROOT, SECOND_SCRIPT_ROOT];

    function captureCallbackPerSourceDirectory(): Map<string, () => void | Promise<void>> {
      const callbacksBySourceDir = new Map<string, () => void | Promise<void>>();
      vi.mocked(watchWithDebounce).mockImplementation((sourceDir, callback) => {
        callbacksBySourceDir.set(sourceDir, callback);
        return { close: vi.fn() } as unknown as FSWatcher;
      });
      return callbacksBySourceDir;
    }

    it("should watch every source directory and return one watcher per directory", async () => {
      // given
      const callbacks = captureCallbackPerSourceDirectory();
      const mockCtx = { watch: vi.fn().mockResolvedValue(undefined) } as unknown as BuildContext;

      // when
      const fsWatchers = await watchEsbuild({
        ctx: mockCtx,
        entryPoints: [ENTRY_POINT_A],
        sourceDirs: BOTH_SCRIPT_ROOTS,
        buildDir,
        createContext: vi.fn(),
        debounceMs: DEBOUNCE_MS,
      });

      // then
      expect([...callbacks.keys()]).toEqual(BOTH_SCRIPT_ROOTS);
      expect(fsWatchers).toHaveLength(2);
    });

    it("should recreate the context with the merged entry points when the second directory changes", async () => {
      // given
      const callbacks = captureCallbackPerSourceDirectory();
      const mergedEntryPoints = [ENTRY_POINT_A, ENTRY_POINT_B];
      vi.mocked(discoverEntryPoints).mockReturnValue(mergedEntryPoints);
      const mockCtx = {
        watch: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as unknown as BuildContext;
      const createContext = vi.fn().mockResolvedValue({
        watch: vi.fn().mockResolvedValue(undefined),
        rebuild: vi.fn().mockResolvedValue({}),
      });

      await watchEsbuild({
        ctx: mockCtx,
        entryPoints: [ENTRY_POINT_A],
        sourceDirs: BOTH_SCRIPT_ROOTS,
        buildDir,
        createContext,
        debounceMs: DEBOUNCE_MS,
      });

      // when — only the second directory reports a change
      await callbacks.get(SECOND_SCRIPT_ROOT)?.();

      // then
      expect(discoverEntryPoints).toHaveBeenCalledWith(BOTH_SCRIPT_ROOTS);
      expect(createContext).toHaveBeenCalledWith(mergedEntryPoints);
    });

    it("should recreate the context once when both directories report the same change at the same time", async () => {
      // given — moving a script between roots fires both watchers for one logical change
      const callbacks = captureCallbackPerSourceDirectory();
      vi.mocked(discoverEntryPoints).mockReturnValue([ENTRY_POINT_A, ENTRY_POINT_B]);
      const mockCtx = {
        watch: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as unknown as BuildContext;
      const createContext = vi.fn().mockResolvedValue({
        watch: vi.fn().mockResolvedValue(undefined),
        rebuild: vi.fn().mockResolvedValue({}),
      });

      await watchEsbuild({
        ctx: mockCtx,
        entryPoints: [ENTRY_POINT_A],
        sourceDirs: BOTH_SCRIPT_ROOTS,
        buildDir,
        createContext,
        debounceMs: DEBOUNCE_MS,
      });

      // when
      await Promise.all([
        callbacks.get(FIRST_SCRIPT_ROOT)?.(),
        callbacks.get(SECOND_SCRIPT_ROOT)?.(),
      ]);

      // then — a second recreation would dispose the context that is already live
      expect(createContext).toHaveBeenCalledOnce();
      expect(mockCtx.dispose).toHaveBeenCalledOnce();
    });

    it("should close every watcher when context recreation fails", async () => {
      // given
      const callbacks = captureCallbackPerSourceDirectory();
      vi.mocked(discoverEntryPoints).mockReturnValue([ENTRY_POINT_A, ENTRY_POINT_B]);
      const mockCtx = {
        watch: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn().mockResolvedValue(undefined),
      } as unknown as BuildContext;
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const fsWatchers = await watchEsbuild({
        ctx: mockCtx,
        entryPoints: [ENTRY_POINT_A],
        sourceDirs: BOTH_SCRIPT_ROOTS,
        buildDir,
        createContext: vi.fn().mockRejectedValue(new Error("build failed")),
        debounceMs: DEBOUNCE_MS,
      });

      // when
      await callbacks.get(FIRST_SCRIPT_ROOT)?.();

      // then
      for (const fsWatcher of fsWatchers) {
        expect(fsWatcher.close).toHaveBeenCalledOnce();
      }
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("should throw when neither or both of sourceDir and sourceDirs are given", async () => {
      const commonOptions = { ctx: {} as BuildContext, entryPoints: [], buildDir, createContext: vi.fn() };
      await expect(watchEsbuild(commonOptions as never)).rejects.toThrow("exactly one of");
      await expect(watchEsbuild({ ...commonOptions, sourceDir: SOURCE_DIR, sourceDirs: [SOURCE_DIR] } as never))
        .rejects.toThrow("exactly one of");
    });
  });
});
