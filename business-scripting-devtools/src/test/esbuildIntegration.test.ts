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

import { existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { context as esbuildContext } from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTypeCheckPlugin, setupEsbuild } from "../esbuild.js";

import {
  createWorkspace,
  FIRST_SOURCE_DIR_NAME,
  HELPER_FILE,
  HELPER_SOURCE,
  type IntegrationWorkspace,
  listBuiltFiles,
  readBuiltFile,
  removeCreatedWorkspaces,
  SCRIPT_FILE,
  scriptImportingFromHelper,
  SECOND_SOURCE_DIR_NAME,
} from "./esbuildIntegrationFixtures.js";

// Spawns `tsc --showConfig` per build, which alone can push a type-check test past the timeout on a busy agent.
vi.mock("../typeCheckerLibraries.js", () => ({ warnAboutLibraryLevel: vi.fn().mockResolvedValue(undefined) }));

/**
 * Real-esbuild builds of temporary source directories, for the assertions a mocked esbuild cannot
 * make: what the emitted files actually contain.
 */

/** Explicit resource management is above es2025, so a pinned target must transpile it away. */
const SCRIPT_USING_SYNTAX_ABOVE_ES2025 = `\
class Closable {
  [Symbol.dispose](): void {}
}
function execute(): number {
  using closable = new Closable();
  return 1;
}
`;

/** Stands for a script with a mistyped entry function as well, which is a helper module nothing imports. */
const UNIMPORTED_HELPER_FILE = "unimported.ts";

function silenceConsoleWarnings() {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

let warnSpy: ReturnType<typeof silenceConsoleWarnings>;

beforeEach(() => {
  warnSpy = silenceConsoleWarnings();
});

afterEach(() => {
  warnSpy.mockRestore();
  removeCreatedWorkspaces();
});

function warnings(): string[] {
  return warnSpy.mock.calls.map((call) => String(call[0]));
}

describe("esbuild integration", () => {
  it("should transpile syntax above the pinned ECMAScript level instead of passing it through", async () => {
    // given
    const workspace = createWorkspace({ [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: SCRIPT_USING_SYNTAX_ABOVE_ES2025 } });

    // when
    await setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: false });

    // then — the engine cannot parse `using`, so the emitted script must not contain it
    const builtScript = readBuiltFile(workspace.buildDir, "script.js");
    expect(builtScript).not.toMatch(/\busing closable\b/);
    expect(builtScript).toContain("Symbol.dispose");
  });

  it("should warn only about the helper module that no script imports", async () => {
    // given — the imported helper reaches the output of another source directory's group only
    const workspace = createWorkspace({
      [FIRST_SOURCE_DIR_NAME]: { [HELPER_FILE]: HELPER_SOURCE, [UNIMPORTED_HELPER_FILE]: HELPER_SOURCE },
      [SECOND_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: scriptImportingFromHelper(`../../${FIRST_SOURCE_DIR_NAME}/src/helper.js`) },
    });

    // when
    await setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: false });

    // then — a helper built as its own output would be registered at runtime as an uncallable script
    expect(listBuiltFiles(workspace.buildDir)).toEqual([`${SECOND_SOURCE_DIR_NAME}/script.js`]);
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]!).toContain(UNIMPORTED_HELPER_FILE);
    expect(warnings()[0]!).not.toContain(HELPER_FILE);
  });

  describe("source maps", () => {
    const SOURCE_MAP_URL_MARKER = "//# sourceMappingURL=";
    const BUILT_SCRIPT_FILE = "script.js";

    function createWorkspaceWithOneScriptImportingOneHelper(): IntegrationWorkspace {
      return createWorkspace({
        [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: scriptImportingFromHelper("./helper.js"), [HELPER_FILE]: HELPER_SOURCE },
      });
    }

    it("should keep the inline source map on the last line of every script", async () => {
      // given
      const workspace = createWorkspaceWithOneScriptImportingOneHelper();

      // when
      await setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: false });

      // then — the runtime and the debugger read the map from the last line, after the post-build edits
      const builtScript = readBuiltFile(workspace.buildDir, BUILT_SCRIPT_FILE);
      expect(builtScript.trimEnd().split("\n").at(-1)).toContain(SOURCE_MAP_URL_MARKER);
    });

    it("should emit a smaller script without any source map when they are switched off", async () => {
      // given
      const withMaps = createWorkspaceWithOneScriptImportingOneHelper();
      await setupEsbuild(withMaps.sourceDirs, withMaps.buildDir, { watch: false });
      const scriptWithMap = readBuiltFile(withMaps.buildDir, BUILT_SCRIPT_FILE);
      const withoutMaps = createWorkspaceWithOneScriptImportingOneHelper();

      // when
      await setupEsbuild(withoutMaps.sourceDirs, withoutMaps.buildDir, { watch: false, sourceMaps: "off" });

      // then - no source map is left, and the script shrinks by the size of the map
      const scriptWithoutMap = readBuiltFile(withoutMaps.buildDir, BUILT_SCRIPT_FILE);
      expect(scriptWithoutMap).not.toContain(SOURCE_MAP_URL_MARKER);
      expect(scriptWithoutMap.length).toBeLessThan(scriptWithMap.length);
    });
  });

  describe("type check", () => {
    const SCRIPT_SOURCE = 'function execute(): string {\n  return "hi";\n}\n';
    const BUILT_SCRIPT_FILE = "script.js";
    const FAKE_TYPE_CHECKER_FILE = "fake-type-checker.mjs";
    const PASSING_VERDICT = 0;
    const FAILING_VERDICT = 2;

    interface FakeTypeCheck {
      /** The command to hand to the build. It reports the verdict set last. */
      command: string;
      setVerdict: (exitCode: number) => void;
    }

    /**
     * A tsc type check mock whose verdict the test sets, starting out passing.
     */
    function createFakeTypeCheck(workspace: IntegrationWorkspace): FakeTypeCheck {
      const typeCheckerFile = join(dirname(workspace.buildDir), FAKE_TYPE_CHECKER_FILE);
      const setVerdict = (exitCode: number) => writeFileSync(typeCheckerFile, `process.exit(${exitCode});\n`);
      setVerdict(PASSING_VERDICT);
      return { command: `node ${typeCheckerFile}`, setVerdict };
    }

    it("should emit nothing while the type check fails, and emit once it passes", async () => {
      // given
      const workspace = createWorkspace({ [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: SCRIPT_SOURCE } });
      const typeCheck = createFakeTypeCheck(workspace);
      const build = () =>
        setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: false, typeCheckCommand: typeCheck.command });
      typeCheck.setVerdict(FAILING_VERDICT);

      // when / then — a script the type check rejects must not reach the build directory
      await expect(build()).rejects.toThrow();
      expect(existsSync(join(workspace.buildDir, BUILT_SCRIPT_FILE))).toBe(false);

      // when the type check passes
      typeCheck.setVerdict(PASSING_VERDICT);
      await build();

      // then
      expect(listBuiltFiles(workspace.buildDir)).toEqual([BUILT_SCRIPT_FILE]);
    });

    it("should remove the built script when a rebuild's type check fails, and restore it once it passes", async () => {
      // given — a watch session is repeated rebuilds of one context, so this is what it does there
      const workspace = createWorkspace({ [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: SCRIPT_SOURCE } });
      const typeCheck = createFakeTypeCheck(workspace);
      const ctx = await esbuildContext({
        entryPoints: [{ in: join(workspace.sourceDirs[0]!, SCRIPT_FILE), out: "script" }],
        bundle: true,
        format: "esm",
        outdir: workspace.buildDir,
        logLevel: "silent",
        plugins: [createTypeCheckPlugin(typeCheck.command)],
      });
      const builtScriptPath = join(workspace.buildDir, BUILT_SCRIPT_FILE);

      try {
        // and a first rebuild that put the script into the build directory
        await ctx.rebuild();
        expect(existsSync(builtScriptPath)).toBe(true);

        // when
        typeCheck.setVerdict(FAILING_VERDICT);

        // then — esbuild takes its own output back, so nothing that fails the check stays deployed
        await expect(ctx.rebuild()).rejects.toThrow();
        expect(existsSync(builtScriptPath)).toBe(false);

        // and it comes back once the check passes again
        typeCheck.setVerdict(PASSING_VERDICT);
        await ctx.rebuild();
        expect(existsSync(builtScriptPath)).toBe(true);
      } finally {
        await ctx.dispose();
      }
    });
  });

  it("should build two helper modules sharing a filename, which only scripts may not", async () => {
    // given — the runtime registers scripts by filename alone, but a helper is never registered
    const workspace = createWorkspace({
      [FIRST_SOURCE_DIR_NAME]: { [SCRIPT_FILE]: scriptImportingFromHelper("./helper.js"), [HELPER_FILE]: HELPER_SOURCE },
      [SECOND_SOURCE_DIR_NAME]: { "other-script.ts": scriptImportingFromHelper("./helper.js"), [HELPER_FILE]: HELPER_SOURCE },
    });

    // when
    await setupEsbuild(workspace.sourceDirs, workspace.buildDir, { watch: false });

    // then
    expect(listBuiltFiles(workspace.buildDir)).toEqual([
      `${FIRST_SOURCE_DIR_NAME}/script.js`,
      `${SECOND_SOURCE_DIR_NAME}/other-script.js`,
    ]);
    expect(warnings()).toEqual([]);
  });
});
