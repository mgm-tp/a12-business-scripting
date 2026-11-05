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

import type { BuildResult, WatchOptions } from "esbuild";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { combineBuildContexts, type CombinedBuildContext } from "../esbuild.js";

const FIRST_OUTPUT_SUBDIRECTORY = "first-scripts";
const SECOND_OUTPUT_SUBDIRECTORY = "second-scripts";
const ESBUILD_WATCH_DELAY_MS = 500;
const BUILD_FAILURE_MESSAGE = "Could not resolve \"./missing.js\"";
const SUCCESSFUL_BUILD_RESULT: BuildResult = {
  errors: [],
  warnings: [],
  outputFiles: undefined,
  metafile: undefined,
  mangleCache: undefined,
};

interface MockBuildContext extends CombinedBuildContext {
  rebuild: Mock<() => Promise<BuildResult>>;
  watch: Mock<(options?: WatchOptions) => Promise<void>>;
  dispose: Mock<() => Promise<void>>;
}

function createMockBuildContext(): MockBuildContext {
  return {
    rebuild: vi.fn<() => Promise<BuildResult>>().mockResolvedValue(SUCCESSFUL_BUILD_RESULT),
    watch: vi.fn<(options?: WatchOptions) => Promise<void>>().mockResolvedValue(undefined),
    dispose: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe("combineBuildContexts", () => {
  let firstBuildContext: MockBuildContext;
  let secondBuildContext: MockBuildContext;
  let combinedBuildContext: CombinedBuildContext;

  beforeEach(() => {
    firstBuildContext = createMockBuildContext();
    secondBuildContext = createMockBuildContext();
    combinedBuildContext = combineBuildContexts([
      { outputSubdirectory: FIRST_OUTPUT_SUBDIRECTORY, buildContext: firstBuildContext },
      { outputSubdirectory: SECOND_OUTPUT_SUBDIRECTORY, buildContext: secondBuildContext },
    ]);
  });

  it("should rebuild every context", async () => {
    // when
    await combinedBuildContext.rebuild();

    // then
    expect(firstBuildContext.rebuild).toHaveBeenCalledOnce();
    expect(secondBuildContext.rebuild).toHaveBeenCalledOnce();
  });

  it("should start watching every context with the given watch options", async () => {
    // when
    await combinedBuildContext.watch({ delay: ESBUILD_WATCH_DELAY_MS });

    // then — a dropped delay would make every group rebuild on every keystroke
    const expectedWatchOptions: WatchOptions = { delay: ESBUILD_WATCH_DELAY_MS };
    expect(firstBuildContext.watch).toHaveBeenCalledWith(expectedWatchOptions);
    expect(secondBuildContext.watch).toHaveBeenCalledWith(expectedWatchOptions);
  });

  it("should dispose every context", async () => {
    // when
    await combinedBuildContext.dispose();

    // then
    expect(firstBuildContext.dispose).toHaveBeenCalledOnce();
    expect(secondBuildContext.dispose).toHaveBeenCalledOnce();
  });

  it("should name the failing output group and the failed operation, keeping the original error as cause", async () => {
    // given — fanning out otherwise hides which of the groups failed
    const buildFailure = new Error(BUILD_FAILURE_MESSAGE);
    secondBuildContext.rebuild.mockRejectedValue(buildFailure);

    // when / then
    await expect(combinedBuildContext.rebuild()).rejects.toThrow(SECOND_OUTPUT_SUBDIRECTORY);
    await expect(combinedBuildContext.rebuild()).rejects.toThrow("rebuild");
    await expect(combinedBuildContext.rebuild()).rejects.toMatchObject({ cause: buildFailure });
  });

  it("should report every failing output group when more than one fails", async () => {
    // given
    firstBuildContext.rebuild.mockRejectedValue(new Error(BUILD_FAILURE_MESSAGE));
    secondBuildContext.rebuild.mockRejectedValue(new Error(BUILD_FAILURE_MESSAGE));

    // when / then
    await expect(combinedBuildContext.rebuild()).rejects.toThrow(FIRST_OUTPUT_SUBDIRECTORY);
    await expect(combinedBuildContext.rebuild()).rejects.toThrow(SECOND_OUTPUT_SUBDIRECTORY);
  });

  it("should still dispose the remaining contexts when one fails to dispose", async () => {
    // given — a context left alive keeps its esbuild child process running
    firstBuildContext.dispose.mockRejectedValue(new Error("dispose failed"));

    // when
    const disposing = combinedBuildContext.dispose();

    // then
    await expect(disposing).rejects.toThrow(FIRST_OUTPUT_SUBDIRECTORY);
    expect(secondBuildContext.dispose).toHaveBeenCalledOnce();
  });

  it("should describe the build root as the origin when there is only one unprefixed group", async () => {
    // given — a single source directory writes straight to the build directory, so it has no subdirectory name
    const singleGroupContext = combineBuildContexts([
      { outputSubdirectory: "", buildContext: firstBuildContext },
    ]);
    firstBuildContext.rebuild.mockRejectedValue(new Error(BUILD_FAILURE_MESSAGE));

    // when / then
    await expect(singleGroupContext.rebuild()).rejects.toThrow("build root");
  });
});
