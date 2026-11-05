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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discoverEntryPointGroups, discoverEntryPoints } from "../entryPoints.js";

const FIRST_SCRIPT_ROOT_LABEL = "first-scripts";
const FLAT_SCRIPT_ROOT_LABEL = "flat-scripts";
const SRC_SEGMENT = "src";
const NESTED_DIRECTORY = "nested-directory";
const FIRST_SCRIPT_FILE = "first-script.ts";
const NESTED_SCRIPT_FILE = "nested-script.ts";
const SCRIPT_FILE = "script.ts";
const DECLARATION_FILE = "types.d.ts";
const HELPER_FILE = "formatting.ts";
const UNREADABLE_FILE = "unreadable.ts";
const ENTRY_FUNCTION_SOURCE = "function execute(): number {\n  return 42;\n}\n";
const HELPER_SOURCE = "export function shout(text: string): string {\n  return text.toUpperCase();\n}\n";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "devtools-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function createScriptFile(...pathSegments: string[]): string {
  return createSourceFile(ENTRY_FUNCTION_SOURCE, ...pathSegments);
}

function createHelperFile(...pathSegments: string[]): string {
  return createSourceFile(HELPER_SOURCE, ...pathSegments);
}

function createSourceFile(tsSource: string, ...pathSegments: string[]): string {
  const filePath = join(tempDir, ...pathSegments);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, tsSource);
  return filePath;
}

describe("discoverEntryPoints", () => {
  it("should pair every .ts file under nested subdirectories with its output path", () => {
    // given
    const script = createScriptFile(SCRIPT_FILE);
    const nestedScript = createScriptFile(NESTED_DIRECTORY, NESTED_SCRIPT_FILE);

    // when
    const result = discoverEntryPoints(tempDir);

    // then
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ in: script, out: "script" });
    expect(result).toContainEqual({ in: nestedScript, out: `${NESTED_DIRECTORY}/nested-script` });
  });

  it("should exclude .d.ts files", () => {
    // given
    const script = createScriptFile(SCRIPT_FILE);
    createScriptFile(DECLARATION_FILE);

    // when
    const result = discoverEntryPoints(tempDir);

    // then
    expect(result).toEqual([{ in: script, out: "script" }]);
  });

  it("should return empty array for an empty directory", () => {
    expect(discoverEntryPoints(tempDir)).toEqual([]);
  });

  it("should treat a single source directory given as a string and as a one-element list identically", () => {
    // given
    createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT, FIRST_SCRIPT_FILE);
    const sourceDir = join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT);

    // then
    expect(discoverEntryPoints(sourceDir)).toEqual(discoverEntryPoints([sourceDir]));
  });

  it("should prefix each output path with its root label when several source directories are configured", () => {
    // given — one root with the conventional src subdirectory, one root holding scripts directly
    const scriptInSrcRoot = createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT, FIRST_SCRIPT_FILE);
    const scriptInFlatRoot = createScriptFile(FLAT_SCRIPT_ROOT_LABEL, NESTED_DIRECTORY, NESTED_SCRIPT_FILE);

    // when
    const result = discoverEntryPoints([
      join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT),
      join(tempDir, FLAT_SCRIPT_ROOT_LABEL),
    ]);

    // then — the label is the concern directory, so a trailing "src" segment is not part of it
    expect(result).toEqual([
      { in: scriptInSrcRoot, out: `${FIRST_SCRIPT_ROOT_LABEL}/first-script` },
      { in: scriptInFlatRoot, out: `${FLAT_SCRIPT_ROOT_LABEL}/${NESTED_DIRECTORY}/nested-script` },
    ]);
  });

  it("should omit the root label when a single source directory is configured", () => {
    // given
    const script = createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT, NESTED_DIRECTORY, NESTED_SCRIPT_FILE);

    // when
    const result = discoverEntryPoints([join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT)]);

    // then — identical to the output path esbuild derived from `outbase` before multi-root support
    expect(result).toEqual([{ in: script, out: `${NESTED_DIRECTORY}/nested-script` }]);
  });

  it("should keep the scripts of a directory and leave out the helper modules they import", () => {
    // given — only the file declaring an entry function is a script; the other is an imported module
    const script = createScriptFile(SCRIPT_FILE);
    createHelperFile(HELPER_FILE);

    // when
    const result = discoverEntryPoints(tempDir);

    // then — a helper built as its own entry point would be registered as an uncallable script
    expect(result).toEqual([{ in: script, out: "script" }]);
  });

  it("should return no entry point for a directory holding helper modules only", () => {
    // given
    createHelperFile(HELPER_FILE);
    createHelperFile(NESTED_DIRECTORY, HELPER_FILE);

    // when / then
    expect(discoverEntryPoints(tempDir)).toEqual([]);
  });

  it("should report and skip a listed path that cannot be read as a source file", () => {
    // given — a directory named like a script is listed like one, and reading it fails
    const script = createScriptFile(SCRIPT_FILE);
    const unreadablePath = join(tempDir, UNREADABLE_FILE);
    mkdirSync(unreadablePath);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // when — an escaping read error would kill a watch session, which exits the process on failure
    const result = discoverEntryPoints(tempDir);

    // then
    expect(result).toEqual([{ in: script, out: "script" }]);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0]![0])).toContain(unreadablePath);
    warnSpy.mockRestore();
  });

  it("should throw when no source directory is configured", () => {
    expect(() => discoverEntryPoints([])).toThrow("no source directory configured");
  });
});

describe("discoverEntryPointGroups", () => {
  it("should return one group per source directory, each output path relative to its own subdirectory", () => {
    // given
    const scriptInSrcRoot = createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT, FIRST_SCRIPT_FILE);
    const scriptInFlatRoot = createScriptFile(FLAT_SCRIPT_ROOT_LABEL, NESTED_DIRECTORY, NESTED_SCRIPT_FILE);

    // when
    const firstSourceDirectory = join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT);
    const flatSourceDirectory = join(tempDir, FLAT_SCRIPT_ROOT_LABEL);
    const result = discoverEntryPointGroups([firstSourceDirectory, flatSourceDirectory]);

    // then — the subdirectory carries the group, so the entry points themselves stay unprefixed
    expect(result).toEqual([
      {
        sourceDirectory: firstSourceDirectory,
        outputSubdirectory: FIRST_SCRIPT_ROOT_LABEL,
        entryPoints: [{ in: scriptInSrcRoot, out: "first-script" }],
      },
      {
        sourceDirectory: flatSourceDirectory,
        outputSubdirectory: FLAT_SCRIPT_ROOT_LABEL,
        entryPoints: [{ in: scriptInFlatRoot, out: `${NESTED_DIRECTORY}/nested-script` }],
      },
    ]);
  });

  it("should return a single group with an empty output subdirectory for one source directory", () => {
    // given
    const script = createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT, NESTED_DIRECTORY, NESTED_SCRIPT_FILE);

    // when
    const sourceDirectory = join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT);
    const result = discoverEntryPointGroups([sourceDirectory]);

    // then — an empty subdirectory keeps the output at the build directory root, as before
    expect(result).toEqual([
      { sourceDirectory, outputSubdirectory: "", entryPoints: [{ in: script, out: `${NESTED_DIRECTORY}/nested-script` }] },
    ]);
  });

  it("should keep a group for a source directory without any script", () => {
    // given — the empty group must still exist, otherwise its output subdirectory silently disappears
    createScriptFile(FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT, FIRST_SCRIPT_FILE);
    mkdirSync(join(tempDir, FLAT_SCRIPT_ROOT_LABEL), { recursive: true });

    // when
    const result = discoverEntryPointGroups([
      join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_SEGMENT),
      join(tempDir, FLAT_SCRIPT_ROOT_LABEL),
    ]);

    // then
    expect(result.map((group) => group.outputSubdirectory)).toEqual([FIRST_SCRIPT_ROOT_LABEL, FLAT_SCRIPT_ROOT_LABEL]);
    expect(result[1]!.entryPoints).toEqual([]);
  });

  it("should throw when no source directory is configured", () => {
    expect(() => discoverEntryPointGroups([])).toThrow("no source directory configured");
  });
});
