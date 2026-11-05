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

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import type { OnStartResult, Plugin, PluginBuild } from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTypeCheckPlugin } from "../typeCheckPlugin.js";

const PASSING_COMMAND = 'node -e "process.exit(0)"';
const DIAGNOSTIC = "src/script.ts(3,7): error TS2322: Type 'number' is not assignable to type 'string'.";
const FAILING_COMMAND = `node -e "console.log(process.argv[1]); process.exit(2)" "${DIAGNOSTIC}"`;
const SILENTLY_FAILING_COMMAND = 'node -e "process.exit(2)"';

/** Registers the plugin with a build and returns its `onStart` callback. */
function onStartCallbackOf(plugin: Plugin): () => Promise<OnStartResult> {
  let onStartCallback: (() => Promise<OnStartResult>) | undefined;
  const mockBuild = {
    onStart: vi.fn((callback: () => Promise<OnStartResult>) => { onStartCallback = callback; }),
  } as unknown as PluginBuild;

  plugin.setup(mockBuild);

  if (onStartCallback === undefined) {
    throw new Error("the plugin registered no onStart callback");
  }
  return onStartCallback;
}

function runTypeCheckOf(typeCheckCommand: string): Promise<OnStartResult> {
  return onStartCallbackOf(createTypeCheckPlugin(typeCheckCommand))();
}

describe("createTypeCheckPlugin", () => {
  it("should let the build proceed when the type check passes", async () => {
    // when
    const result = await runTypeCheckOf(PASSING_COMMAND);

    // then
    expect(result).toEqual({});
  });

  it("should fail the build with the type checker's own diagnostics", async () => {
    // when
    const result = await runTypeCheckOf(FAILING_COMMAND);

    // then — the scripter reads the type checker's message, not a paraphrase of it
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]?.text).toContain(DIAGNOSTIC);
  });

  it("should name the exit code when the type check fails without any output", async () => {
    // when
    const result = await runTypeCheckOf(SILENTLY_FAILING_COMMAND);

    // then — an unexplained failure must still say what happened
    expect(result.errors?.[0]?.text).toContain("exit code 2");
    expect(result.errors?.[0]?.text).toContain("without any output");
  });

  it("should fail the build when the command cannot be run at all", async () => {
    // when
    const result = await runTypeCheckOf("");

    // then
    expect(result.errors).toHaveLength(1);
  });

  describe("several output groups", () => {
    let tempDir: string;
    let runCountFile: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "devtools-type-check-test-"));
      runCountFile = join(tempDir, "runs");
      writeFileSync(runCountFile, "");
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    function countingCommand(): string {
      return `node -e "require('fs').appendFileSync(process.argv[1], 'x')" "${runCountFile}"`;
    }

    function runCount(): number {
      return readFileSync(runCountFile, "utf-8").length;
    }

    it("should run the command for every build, concurrent ones included", async () => {
      // given
      const plugin = createTypeCheckPlugin(countingCommand());
      const firstGroupTypeCheck = onStartCallbackOf(plugin);
      const secondGroupTypeCheck = onStartCallbackOf(plugin);

      // when
      const results = await Promise.all([firstGroupTypeCheck(), secondGroupTypeCheck()]);

      // then - a build sharing a check that started before its own edit was saved could emit a script
      // that does not type-check
      expect(results).toEqual([{}, {}]);
      expect(runCount()).toBe(2);
    });

    it("should run the command again for the next build", async () => {
      // given
      const typeCheck = onStartCallbackOf(createTypeCheckPlugin(countingCommand()));

      // when — a rebuild must see the sources as they are now, not as the last check found them
      await typeCheck();
      await typeCheck();

      // then
      expect(runCount()).toBe(2);
    });
  });
});
