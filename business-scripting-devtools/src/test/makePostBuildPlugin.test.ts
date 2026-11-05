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

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import type { BuildResult, Message, PluginBuild } from "esbuild";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { createPostBuildPlugin } from "../esbuild.js";
import { injectScriptMetadata } from "../scriptMetadata.js";
import { stripNodeModulesFromSourceMaps } from "../sourceMap.js";

const EXECUTE_FUNCTION = "function execute() {}"

vi.mock("../scriptMetadata.js", () => ({
  injectScriptMetadata: vi.fn(),
}));

vi.mock("../sourceMap.js", () => ({
  stripNodeModulesFromSourceMaps: vi.fn(),
}));

describe("createPostBuildPlugin", () => {
  let tempDir: string;
  let sourceDir: string;
  let buildDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), "devtools-post-build-test-"));
    sourceDir = join(tempDir, "src");
    buildDir = join(tempDir, "build");
    mkdirSync(sourceDir);
    mkdirSync(buildDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  type OnEndCallback = (result: BuildResult) => Promise<void>;

  async function runOnEndCallbackOf(
    plugin: ReturnType<typeof createPostBuildPlugin>,
    buildErrors: Message[] = []
  ): Promise<void> {
    let onEndCallback: OnEndCallback | undefined;
    const mockBuild = {
      onEnd: vi.fn((callback: OnEndCallback) => { onEndCallback = callback; }),
    } as unknown as PluginBuild;
    plugin.setup(mockBuild);
    expect(onEndCallback).toBeDefined();
    await onEndCallback!({ errors: buildErrors, warnings: [] } as unknown as BuildResult);
  }

  it("should inject metadata for the discovered entry points and strip node_modules source maps", async () => {
    // given
    writeFileSync(join(sourceDir, "script.ts"), EXECUTE_FUNCTION);

    // when
    await runOnEndCallbackOf(createPostBuildPlugin({ sourceDir, buildDir }));

    // then
    expect(injectScriptMetadata).toHaveBeenCalledWith({
      buildDir,
      entryPoints: [{ in: join(sourceDir, "script.ts"), out: "script" }],
    });
    expect(stripNodeModulesFromSourceMaps).toHaveBeenCalledWith(buildDir);
  });

  it("should rediscover entry points on every build so scripts added while watching are included", async () => {
    // given — plugin created before the second script exists
    writeFileSync(join(sourceDir, "first.ts"), EXECUTE_FUNCTION);
    const plugin = createPostBuildPlugin({ sourceDir, buildDir });
    await runOnEndCallbackOf(plugin);
    writeFileSync(join(sourceDir, "second.ts"), EXECUTE_FUNCTION);

    // when
    await runOnEndCallbackOf(plugin);

    // then
    expect(injectScriptMetadata).toHaveBeenLastCalledWith({
      buildDir,
      entryPoints: [
        { in: join(sourceDir, "first.ts"), out: "first" },
        { in: join(sourceDir, "second.ts"), out: "second" },
      ],
    });
  });

  it("should pass a fixed entry point mapping through unchanged", async () => {
    // given
    const entryPoints = [{ in: join(sourceDir, "script.ts"), out: "first-scripts/script" }];

    // when
    await runOnEndCallbackOf(createPostBuildPlugin({ entryPoints, buildDir }));

    // then
    expect(injectScriptMetadata).toHaveBeenCalledWith({ buildDir, entryPoints });
  });

  it("should post-process nothing for a group without a script, which writes no output directory", async () => {
    // given — a source directory holding helper modules only yields a group with no entry point
    writeFileSync(join(sourceDir, "helper.ts"), "export const answer = 42;");

    // when
    await runOnEndCallbackOf(createPostBuildPlugin({ sourceDir, buildDir }));

    // then — scanning an output directory esbuild never created would fail the build
    expect(injectScriptMetadata).not.toHaveBeenCalled();
    expect(stripNodeModulesFromSourceMaps).not.toHaveBeenCalled();
  });

  it("should post-process nothing after a failed build, which leaves no output behind", async () => {
    // given — a failing type check or a syntax error makes esbuild remove the whole output directory
    writeFileSync(join(sourceDir, "script.ts"), EXECUTE_FUNCTION);
    const buildError = { text: "type check failed" } as Message;

    // when
    await runOnEndCallbackOf(createPostBuildPlugin({ sourceDir, buildDir }), [buildError]);

    // then — scanning the removed directory would bury the real error under an ENOENT
    expect(injectScriptMetadata).not.toHaveBeenCalled();
    expect(stripNodeModulesFromSourceMaps).not.toHaveBeenCalled();
  });

  it("should throw when neither or both of the source directories and the entry points are given", () => {
    expect(() => createPostBuildPlugin({ buildDir } as never))
      .toThrow("exactly one of");
    expect(() => createPostBuildPlugin({ buildDir, sourceDir, entryPoints: [] } as never))
      .toThrow("exactly one of");
  });
});
