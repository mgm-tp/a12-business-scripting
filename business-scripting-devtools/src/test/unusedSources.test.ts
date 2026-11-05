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
import { join, relative } from "path";
import { tmpdir } from "os";

import type { BuildResult, Metafile } from "esbuild";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { warnAboutUnusedSourceFiles } from "../unusedSources.js";

const FIRST_SOURCE_DIR_NAME = "first-scripts";
const SECOND_SOURCE_DIR_NAME = "second-scripts";
const SCRIPT_FILE = "script.ts";
const HELPER_FILE = "helper.ts";
const ORPHAN_FILE = "orphan.ts";
const SECOND_ORPHAN_FILE = "second-orphan.ts";
const TYPE_ONLY_FILE = "types.ts";
const SOURCE_TEXT = "export const answer = 42;\n";
const TYPE_ONLY_SOURCE_TEXT = "export interface Answer { value: number }\nexport type Id = string;\n";

function silenceConsoleWarnings() {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

let tempDir: string;
let warnSpy: ReturnType<typeof silenceConsoleWarnings>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "devtools-unused-test-"));
  warnSpy = silenceConsoleWarnings();
});

afterEach(() => {
  warnSpy.mockRestore();
  rmSync(tempDir, { recursive: true, force: true });
});

function createSourceDirWithFiles(sourceDirName: string, ...fileNames: string[]): string {
  const sourceDir = join(tempDir, sourceDirName);
  mkdirSync(sourceDir, { recursive: true });
  fileNames.forEach((fileName) => writeFileSync(join(sourceDir, fileName), SOURCE_TEXT));
  return sourceDir;
}

/** Mimics esbuild, which reports metafile paths relative to the current working directory. */
function toMetafilePath(sourceDir: string, fileName: string): string {
  return relative(process.cwd(), join(sourceDir, fileName));
}

function buildResultWithOutputBuiltFrom(...inputPaths: string[]): BuildResult {
  const inputs = Object.fromEntries(inputPaths.map((inputPath) => [inputPath, { bytesInOutput: 1 }]));
  const metafile = { inputs: {}, outputs: { "build/script.js": { inputs } } } as unknown as Metafile;
  return { metafile } as BuildResult;
}

function onlyWarning(): string {
  expect(warnSpy).toHaveBeenCalledOnce();
  return String(warnSpy.mock.calls[0]![0]);
}

describe("warnAboutUnusedSourceFiles", () => {
  it("should name a source file with runtime code that no built script was built from", async () => {
    // given — the orphan is the shape a script whose entry function is mistyped now has
    const sourceDir = createSourceDirWithFiles(FIRST_SOURCE_DIR_NAME, SCRIPT_FILE, ORPHAN_FILE);

    // when
    await warnAboutUnusedSourceFiles(
      [sourceDir],
      [buildResultWithOutputBuiltFrom(toMetafilePath(sourceDir, SCRIPT_FILE))]
    );

    // then
    const warning = onlyWarning();
    expect(warning).toContain(ORPHAN_FILE);
    expect(warning).not.toContain(SCRIPT_FILE);
  });

  it("should stay silent about a helper module that another output group's script was built from", async () => {
    // given — a helper shared across source directories reaches the output of the importing group only
    const firstSourceDir = createSourceDirWithFiles(FIRST_SOURCE_DIR_NAME, HELPER_FILE);
    const secondSourceDir = createSourceDirWithFiles(SECOND_SOURCE_DIR_NAME, SCRIPT_FILE);

    // when
    await warnAboutUnusedSourceFiles(
      [firstSourceDir, secondSourceDir],
      [
        buildResultWithOutputBuiltFrom(),
        buildResultWithOutputBuiltFrom(
          toMetafilePath(secondSourceDir, SCRIPT_FILE),
          toMetafilePath(firstSourceDir, HELPER_FILE)
        ),
      ]
    );

    // then
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should report all unused source files with runtime code in one warning", async () => {
    // given — one warning per file would bury the build output of a directory left behind wholesale
    const sourceDir = createSourceDirWithFiles(FIRST_SOURCE_DIR_NAME, SCRIPT_FILE, ORPHAN_FILE, SECOND_ORPHAN_FILE);

    // when
    await warnAboutUnusedSourceFiles(
      [sourceDir],
      [buildResultWithOutputBuiltFrom(toMetafilePath(sourceDir, SCRIPT_FILE))]
    );

    // then
    const warning = onlyWarning();
    expect(warning).toContain(ORPHAN_FILE);
    expect(warning).toContain(SECOND_ORPHAN_FILE);
  });

  it("should match a metafile path given with backslashes", async () => {
    // given — on Windows the comparison would otherwise pass vacuously and warn about every script
    const sourceDir = createSourceDirWithFiles(FIRST_SOURCE_DIR_NAME, SCRIPT_FILE);
    const windowsStyleInputPath = toMetafilePath(sourceDir, SCRIPT_FILE).replace(/\//g, "\\");

    // when
    await warnAboutUnusedSourceFiles([sourceDir], [buildResultWithOutputBuiltFrom(windowsStyleInputPath)]);

    // then
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should stay silent about a module holding only type declarations", async () => {
    // given — esbuild elides a type-only import along with the types, so no metafile names the module
    const sourceDir = createSourceDirWithFiles(FIRST_SOURCE_DIR_NAME, SCRIPT_FILE);
    writeFileSync(join(sourceDir, TYPE_ONLY_FILE), TYPE_ONLY_SOURCE_TEXT);

    // when
    await warnAboutUnusedSourceFiles(
      [sourceDir],
      [buildResultWithOutputBuiltFrom(toMetafilePath(sourceDir, SCRIPT_FILE))]
    );

    // then — it reaches the scripts through the type check alone, which is not dead code
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should report the missing metafile instead of every source file when a build produced none", async () => {
    // given
    const sourceDir = createSourceDirWithFiles(FIRST_SOURCE_DIR_NAME, SCRIPT_FILE);

    // when
    await warnAboutUnusedSourceFiles([sourceDir], [{} as BuildResult]);

    // then — reporting every script as unused would be worse than saying nothing is known
    const warning = onlyWarning();
    expect(warning).toContain("metafile");
    expect(warning).not.toContain(SCRIPT_FILE);
  });
});
