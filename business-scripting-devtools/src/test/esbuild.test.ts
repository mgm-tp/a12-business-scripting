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
import { dirname, join } from "path";
import { tmpdir } from "os";

import { build, type Plugin } from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createKeepEntryFunctionPlugin, keepEntryFunctionPlugin } from "../esbuild.js";

const ENTRY_FUNCTION_SOURCE = "function execute() { return 42; }";
const BUILD_DIR_NAME = "build";
const SRC_DIR_NAME = "src";
const SCRIPT_FILE = "script.ts";
const HELPER_FILE = "helper.ts";
const FIRST_SCRIPT_ROOT_LABEL = "first-scripts";
const SECOND_SCRIPT_ROOT_LABEL = "second-scripts";
const FIRST_SCRIPT_FILE = "first-script.ts";
const SECOND_SCRIPT_FILE = "second-script.ts";

async function bundleWithPlugin(entryPoints: string[], plugin: Plugin, outdir: string): Promise<string[]> {
  const result = await build({
    entryPoints,
    bundle: true,
    format: "esm",
    write: false,
    outdir,
    plugins: [plugin],
  });
  return result.outputFiles.map((outputFile) => outputFile.text);
}

describe("keepEntryFunctionPlugin", () => {
  let tempDir: string;
  let srcDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), "devtools-esbuild-test-"));
    srcDir = join(tempDir, SRC_DIR_NAME);
    mkdirSync(srcDir);
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should keep entry function in output when ts file has a matching function signature", async () => {
    // given
    writeFileSync(join(srcDir, SCRIPT_FILE), ENTRY_FUNCTION_SOURCE);

    // when
    const outputs = await bundleWithPlugin([join(srcDir, SCRIPT_FILE)], keepEntryFunctionPlugin, join(tempDir, BUILD_DIR_NAME));

    // then — function body is present, proving it was not tree-shaken
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!).toMatch(/function\s+execute/);
    expect(outputs[0]!).toContain("return 42");
  });

  it("should not inject export for ts file without a matching function signature", async () => {
    // given — side-effecting code so the output is non-empty regardless of tree-shaking
    writeFileSync(join(srcDir, SCRIPT_FILE), "const value = 42;\nconsole.log(value);");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // when
    const outputs = await bundleWithPlugin([join(srcDir, SCRIPT_FILE)], keepEntryFunctionPlugin, join(tempDir, BUILD_DIR_NAME));

    // then — output has code but no plugin-injected export block, and no per-file warning
    expect(outputs[0]!).toContain("console.log");
    expect(outputs[0]!).not.toContain("export {");
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should bundle a helper module a script imports without warning about it", async () => {
    // given — the helper is an ordinary import, not a script, so nothing about it is worth reporting
    writeFileSync(join(srcDir, HELPER_FILE), "export function shout(text: string): string { return text; }");
    writeFileSync(
      join(srcDir, SCRIPT_FILE),
      `import { shout } from "./helper.js";\nfunction execute() { return shout("hi"); }`
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // when
    const outputs = await bundleWithPlugin([join(srcDir, SCRIPT_FILE)], keepEntryFunctionPlugin, join(tempDir, BUILD_DIR_NAME));

    // then — the helper is inlined into the script, and appending an export to it would fail the build
    expect(outputs).toHaveLength(1);
    expect(outputs[0]!).toContain("function shout");
    expect(outputs[0]!).toContain("export {");
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should not inject export for ts file outside the src directory", async () => {
    // given — matching function in a file outside src/
    const outsideFile = join(tempDir, "outside.ts");
    writeFileSync(outsideFile, ENTRY_FUNCTION_SOURCE);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // when
    const outputs = await bundleWithPlugin([outsideFile], keepEntryFunctionPlugin, join(tempDir, BUILD_DIR_NAME));

    // then — plugin skips the file; no export block injected
    expect(outputs[0]!).not.toContain("export {");
    warnSpy.mockRestore();
  });
});

describe("createKeepEntryFunctionPlugin", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devtools-esbuild-multiroot-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createScriptFile(...pathSegments: string[]): string {
    const filePath = join(tempDir, ...pathSegments);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, ENTRY_FUNCTION_SOURCE);
    return filePath;
  }

  it("should keep the entry function of scripts in every configured source directory", async () => {
    // given
    const scriptInFirstRoot = createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_DIR_NAME, FIRST_SCRIPT_FILE);
    const scriptInSecondRoot = createScriptFile(SECOND_SCRIPT_ROOT_LABEL, SRC_DIR_NAME, SECOND_SCRIPT_FILE);
    const plugin = createKeepEntryFunctionPlugin([
      join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_DIR_NAME),
      join(tempDir, SECOND_SCRIPT_ROOT_LABEL, SRC_DIR_NAME),
    ]);

    // when
    const outputs = await bundleWithPlugin([scriptInFirstRoot, scriptInSecondRoot], plugin, join(tempDir, BUILD_DIR_NAME));

    // then — both entry functions survived tree-shaking
    expect(outputs).toHaveLength(2);
    for (const output of outputs) {
      expect(output).toMatch(/function\s+execute/);
      expect(output).toContain("export {");
    }
  });

  it("should warn and pass through a ts file outside every configured source directory", async () => {
    // given
    const scriptOutsideEveryRoot = createScriptFile("elsewhere", "stray-script.ts");
    const firstRoot = join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_DIR_NAME);
    const secondRoot = join(tempDir, SECOND_SCRIPT_ROOT_LABEL, SRC_DIR_NAME);
    mkdirSync(firstRoot, { recursive: true });
    mkdirSync(secondRoot, { recursive: true });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // when
    const outputs = await bundleWithPlugin(
      [scriptOutsideEveryRoot],
      createKeepEntryFunctionPlugin([firstRoot, secondRoot]),
      join(tempDir, BUILD_DIR_NAME)
    );

    // then — no export injected, and the skip is reported with the file and the configured directories
    expect(outputs[0]!).not.toContain("export {");
    expect(warnSpy).toHaveBeenCalledOnce();
    const warning = warnSpy.mock.calls[0]![0] as string;
    expect(warning).toContain("[keep-entry-function]");
    expect(warning).toContain(scriptOutsideEveryRoot);
    expect(warning).toContain(firstRoot);
    expect(warning).toContain(secondRoot);
    warnSpy.mockRestore();
  });
});
