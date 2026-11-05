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

import type { BuildContext, WatchOptions } from "esbuild";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { discoverEntryPoints } from "../entryPoints.js";
import { watchEsbuild } from "../esbuild.js";
import { warnAboutUnusedSourceFiles } from "../unusedSources.js";
import { watchWithDebounce } from "../watch.js";

const DEBOUNCE_MS = 100;
const ESBUILD_WATCH_DELAY_MS = 500;
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
  let mockFsWatcher: FSWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    buildDir = mkdtempSync(join(resolve("."), "devtools-watchEsbuild-test-"));
    mockFsWatcher = { close: vi.fn() } as unknown as FSWatcher;
  });

  afterEach(() => {
    rmSync(buildDir, { recursive: true, force: true });
  });

  it("should throw when buildDir is outside cwd", async () => {
      // given
      const mockCtx = { watch: vi.fn() } as unknown as BuildContext;

      // when / then
      await expect(
          watchEsbuild({
              ctx: mockCtx,
              entryPoints: [],
              sourceDir: SOURCE_DIR,
              buildDir: "..",
              createContext: vi.fn(),
          }),
      ).rejects.toThrow("unsafe buildDir");
  });

  it("should start ctx.watch() and watchWithDebounce on startup", async () => {
    // given
    vi.mocked(watchWithDebounce).mockReturnValue(mockFsWatcher);
    const mockCtx = { watch: vi.fn().mockResolvedValue(undefined) } as unknown as BuildContext;

    // when
    const fsWatcher = await watchEsbuild({
      ctx: mockCtx,
      entryPoints: [ENTRY_POINT_A],
      sourceDir: SOURCE_DIR,
      buildDir,
      createContext: vi.fn(),
      debounceMs: DEBOUNCE_MS,
      esbuildWatchDelay: ESBUILD_WATCH_DELAY_MS,
    });

    // then
    expect(mockCtx.watch).toHaveBeenCalledWith({ delay: ESBUILD_WATCH_DELAY_MS } satisfies WatchOptions);
    expect(watchWithDebounce).toHaveBeenCalledWith(SOURCE_DIR, expect.any(Function), DEBOUNCE_MS);
    expect(fsWatcher).toEqual([mockFsWatcher]);
  });

  it("should use default debounceMs and esbuildWatchDelay when not provided", async () => {
    // given
    vi.mocked(watchWithDebounce).mockReturnValue(mockFsWatcher);
    const mockCtx = { watch: vi.fn().mockResolvedValue(undefined) } as unknown as BuildContext;

    // when
    await watchEsbuild({
      ctx: mockCtx,
      entryPoints: [],
      sourceDir: SOURCE_DIR,
      buildDir,
      createContext: vi.fn(),
    });

    // then
    expect(mockCtx.watch).toHaveBeenCalledWith({ delay: ESBUILD_WATCH_DELAY_MS });
    expect(watchWithDebounce).toHaveBeenCalledWith(SOURCE_DIR, expect.any(Function), 200);
  });

  it("should recreate context when entryPoints change", async () => {
    // given
    let capturedCallback: (() => void | Promise<void>) | undefined;
    vi.mocked(watchWithDebounce).mockImplementation((_, callback) => {
      capturedCallback = callback;
      return mockFsWatcher;
    });

    const initialEntryPoints = [ENTRY_POINT_A];
    const newEntryPoints = [ENTRY_POINT_A, ENTRY_POINT_B];
    vi.mocked(discoverEntryPoints).mockReturnValue(newEntryPoints);

    const mockCtx: { watch: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } = {
      watch: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
    };
    const rebuildResults = [{ metafile: { inputs: {}, outputs: {} } }];
    const mockNewCtx = {
      watch: vi.fn().mockResolvedValue(undefined),
      rebuild: vi.fn().mockResolvedValue(rebuildResults),
    };
    const createContext = vi.fn().mockResolvedValue(mockNewCtx);

    await watchEsbuild({
      ctx: mockCtx as unknown as BuildContext,
      entryPoints: initialEntryPoints,
      sourceDir: SOURCE_DIR,
      buildDir,
      createContext,
      debounceMs: DEBOUNCE_MS,
      esbuildWatchDelay: ESBUILD_WATCH_DELAY_MS,
    });

    // when — simulate entrypoint change
    await capturedCallback?.();

    // then
    expect(mockCtx.dispose).toHaveBeenCalledOnce();
    expect(createContext).toHaveBeenCalledWith(newEntryPoints);
    expect(mockNewCtx.rebuild).toHaveBeenCalledOnce();
    expect(mockNewCtx.watch).toHaveBeenCalledWith({ delay: ESBUILD_WATCH_DELAY_MS } satisfies WatchOptions);
    // A script whose entry function was mistyped between two sessions is reported on recreation.
    expect(warnAboutUnusedSourceFiles).toHaveBeenCalledWith([SOURCE_DIR], rebuildResults);

    // when — simulate second callback with same new entrypoints (currentEntrypoints updated → no-op)
    vi.mocked(discoverEntryPoints).mockReturnValue(newEntryPoints);
    await capturedCallback?.();

    // then — no second recreation: proves currentEntrypoints was updated after first callback
    expect(mockCtx.dispose).toHaveBeenCalledOnce();
    expect(createContext).toHaveBeenCalledOnce();
  });

  it("should keep watching when the first build of the recreated context fails", async () => {
    // given — a new script that does not compile or type-check fails that build; the next edit may fix it
    let capturedCallback: (() => void | Promise<void>) | undefined;
    vi.mocked(watchWithDebounce).mockImplementation((_, callback) => {
      capturedCallback = callback;
      return mockFsWatcher;
    });
    const newEntryPoints = [ENTRY_POINT_A, ENTRY_POINT_B];
    vi.mocked(discoverEntryPoints).mockReturnValue(newEntryPoints);
    const mockCtx = {
      watch: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
    } as unknown as BuildContext;
    const mockNewCtx = {
      watch: vi.fn().mockResolvedValue(undefined),
      rebuild: vi.fn().mockRejectedValue(new Error("Build failed with 1 error:\nerror: type check failed")),
    };
    const createContext = vi.fn().mockResolvedValue(mockNewCtx);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await watchEsbuild({
      ctx: mockCtx,
      entryPoints: [ENTRY_POINT_A],
      sourceDir: SOURCE_DIR,
      buildDir,
      createContext,
      debounceMs: DEBOUNCE_MS,
      esbuildWatchDelay: ESBUILD_WATCH_DELAY_MS,
    });

    // when
    await capturedCallback?.();

    // then — the failure is stated and the new context watches for the next edit
    expect(exitSpy).not.toHaveBeenCalled();
    expect(mockFsWatcher.close).not.toHaveBeenCalled();
    expect(mockNewCtx.watch).toHaveBeenCalledWith({ delay: ESBUILD_WATCH_DELAY_MS } satisfies WatchOptions);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]![0])).toContain("Build failed with 1 error");
    expect(warnAboutUnusedSourceFiles).not.toHaveBeenCalled();

    // when — the same entry points are reported again
    await capturedCallback?.();

    // then — the failed build's entry points were recorded, so the context is not recreated a second time
    expect(createContext).toHaveBeenCalledOnce();
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it.each([
    { label: "unchanged", initial: [ENTRY_POINT_A], discovered: [ENTRY_POINT_A] },
    { label: "reordered", initial: [ENTRY_POINT_A, ENTRY_POINT_B], discovered: [ENTRY_POINT_B, ENTRY_POINT_A] },
  ])("should not recreate context when entryPoints are $label", async ({ initial, discovered }) => {
    // given
    let capturedCallback: (() => void | Promise<void>) | undefined;
    vi.mocked(watchWithDebounce).mockImplementation((_, callback) => {
      capturedCallback = callback;
      return mockFsWatcher;
    });

    vi.mocked(discoverEntryPoints).mockReturnValue(discovered);

    const mockCtx: { watch: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } = {
      watch: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    };
    const createContext = vi.fn();

    await watchEsbuild({
      ctx: mockCtx as unknown as BuildContext,
      entryPoints: initial,
      sourceDir: SOURCE_DIR,
      buildDir,
      createContext,
      debounceMs: DEBOUNCE_MS,
      esbuildWatchDelay: ESBUILD_WATCH_DELAY_MS,
    });

    // when
    await capturedCallback?.();

    // then — no context recreation
    expect(mockCtx.dispose).not.toHaveBeenCalled();
    expect(createContext).not.toHaveBeenCalled();
  });

  it("should exit process when context recreation fails", async () => {
    // given
    let capturedCallback: (() => void | Promise<void>) | undefined;
    vi.mocked(watchWithDebounce).mockImplementation((_, callback) => {
      capturedCallback = callback;
      return mockFsWatcher;
    });

    vi.mocked(discoverEntryPoints).mockReturnValue([ENTRY_POINT_A, ENTRY_POINT_B]);

    const mockCtx: { watch: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } = {
      watch: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
    };
    const createContext = vi.fn().mockRejectedValue(new Error("build failed"));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await watchEsbuild({
      ctx: mockCtx as unknown as BuildContext,
      entryPoints: [ENTRY_POINT_A],
      sourceDir: SOURCE_DIR,
      buildDir,
      createContext,
      debounceMs: DEBOUNCE_MS,
      esbuildWatchDelay: ESBUILD_WATCH_DELAY_MS,
    });

    // when
    await capturedCallback?.();

    // then
    expect(mockFsWatcher.close).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
