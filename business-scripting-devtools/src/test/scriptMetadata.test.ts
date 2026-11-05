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

import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "fs";
import {dirname, join} from "path";
import {tmpdir} from "os";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {discoverEntryPoints} from "../entryPoints.js";
import {injectScriptMetadata} from "../scriptMetadata.js";

const SCRIPT_JS_FILENAME = "script.js";
const TYPED_INPUTS_TS = "interface Inputs { name: string; }\nfunction execute(inputs: Inputs) {}";
const TYPED_INPUTS_JS = "function execute(inputs) {}";
const NO_PARAMS_SOURCE = "function execute() {}";
const EXPECTED_PARAM_TYPES = 'execute.__paramTypes = {"name":"string"};';

const FIRST_SCRIPT_ROOT_LABEL = "first-scripts";
const SECOND_SCRIPT_ROOT_LABEL = "second-scripts";
const SRC_DIR_NAME = "src";
const NESTED_DIRECTORY = "nested-directory";
const FIRST_SCRIPT_FILE = "first-script.ts";
const FIRST_SCRIPT_OUTPUT_FILE = "first-script.js";
const NESTED_SCRIPT_FILE = "nested-script.ts";
const NESTED_SCRIPT_OUTPUT_FILE = "nested-script.js";

describe("injectScriptMetadata", () => {
  let tempDir: string;
  let sourceDir: string;
  let buildDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devtools-test-"));
    sourceDir = join(tempDir, "src");
    buildDir = join(tempDir, "build");
    mkdirSync(sourceDir);
    mkdirSync(buildDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeScript(tsSource: string, jsSource: string): void {
    writeFileSync(join(sourceDir, "script.ts"), tsSource);
    writeFileSync(join(buildDir, SCRIPT_JS_FILENAME), jsSource + "\nexport { execute };\n");
  }

  function readResult(): string {
    return readFileSync(join(buildDir, SCRIPT_JS_FILENAME), "utf-8");
  }

  function injectMetadataForSourceDir(): void {
    injectScriptMetadata({ buildDir, entryPoints: discoverEntryPoints(sourceDir) });
  }

  describe("ESM export block", () => {
  it("should be preserved when metadata is injected", () => {
      // given
      writeScript(TYPED_INPUTS_TS, TYPED_INPUTS_JS);

      // when
      injectMetadataForSourceDir();

      // then
      const result = readResult();
      expect(result).toContain("export { execute };");
      expect(result).toContain("execute.__paramTypes");
    });
  })

  describe("__paramTypes", () => {
    it("should inject __paramTypes when function has a typed parameter with an interface", () => {
      // given
      writeScript(TYPED_INPUTS_TS, TYPED_INPUTS_JS);

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__paramTypes = {"name":"string"};');
    });

    it("should not inject __paramTypes when function has no parameters", () => {
      // given
      writeScript(NO_PARAMS_SOURCE, NO_PARAMS_SOURCE);

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).not.toContain("__paramTypes");
    });

    it("should inject __paramTypes for interface with inline single-line nested object type", () => {
      // given
      writeScript(
        "interface Inputs { nested: { inner: string }; }\nfunction execute(inputs: Inputs) {}",
        TYPED_INPUTS_JS,
      );

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__paramTypes = {"nested":"{ inner: string }"};');
    });

    it("should inject __paramTypes for interface with multi-line nested object type", () => {
      // given
      writeScript(
        "interface Inputs {\n  nested: {\n    inner: number;\n  };\n}\nfunction execute(inputs: Inputs) {}",
        TYPED_INPUTS_JS,
      );

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__paramTypes = {"nested":"{ inner: number }"}');
    });
  });

  describe("__returnProperties", () => {
    it("should inject __returnProperties when function has a non-void return type with an interface", () => {
      // given
      writeScript(
        "interface Outputs { result: string; }\nfunction execute(): Outputs { return { result: 'x' }; }",
        "function execute() { return { result: 'x' }; }",
      );

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__returnProperties = {"result":"string"};');
    });

    it("should not inject __returnProperties when function has no return type", () => {
      // given
      writeScript(NO_PARAMS_SOURCE, NO_PARAMS_SOURCE);

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).not.toContain("__returnProperties");
    });
  });

  describe("interface comments", () => {
    it("should strip inline line comments from interface properties", () => {
      // given
      writeScript(
        "interface Inputs {\n  name: string; // the name\n  count: number; // how many\n}\nfunction execute(inputs: Inputs) {}",
        TYPED_INPUTS_JS,
      );

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__paramTypes = {"name":"string","count":"number"};');
    });

    it("should strip inline block comments from interface properties", () => {
      // given
      writeScript(
        "interface Outputs {\n  result: string; /* the result */\n  count: number; /* how many */\n}\nfunction execute(): Outputs { return { result: 'x', count: 1 }; }",
        "function execute() { return { result: 'x', count: 1 }; }",
      );

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__returnProperties = {"result":"string","count":"number"};');
    });

    it("should extract all properties when a comment contains a closing brace", () => {
      // given
      writeScript(
        "interface Inputs {\n  name: string; // see {Foo} for details\n  count: number;\n}\nfunction execute(inputs: Inputs) {}",
        TYPED_INPUTS_JS,
      );

      // when
      injectMetadataForSourceDir();

      // then
      expect(readResult()).toContain('execute.__paramTypes = {"name":"string","count":"number"};');
    });
  });

  describe("source map comment", () => {
    const SOURCE_MAP_LINE = "//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==";

    it("should insert metadata before the source map comment", () => {
      // given
      writeScript(
        TYPED_INPUTS_TS,
        `${TYPED_INPUTS_JS}\n${SOURCE_MAP_LINE}`,
      );

      // when
      injectMetadataForSourceDir();

      // then
      const result = readResult();
      const metadataIdx = result.indexOf("execute.__paramTypes");
      const sourceMapIdx = result.indexOf("//# sourceMappingURL");
      expect(metadataIdx).toBeGreaterThan(-1);
      expect(metadataIdx).toBeLessThan(sourceMapIdx);
    });

    it("should leave the source map comment on the last line", () => {
      // given — the script engine reads the sourceMappingURL from the final line of a script,
      // so the output is laid out the way esbuild writes it: the map comment last
      writeFileSync(join(sourceDir, "script.ts"), TYPED_INPUTS_TS);
      writeFileSync(join(buildDir, SCRIPT_JS_FILENAME), `${TYPED_INPUTS_JS}\nexport { execute };\n${SOURCE_MAP_LINE}\n`);

      // when
      injectMetadataForSourceDir();

      // then
      const lines = readResult().trimEnd().split("\n");
      expect(lines[lines.length - 1]).toBe(SOURCE_MAP_LINE);
    });
  });

  describe("missing build output", () => {
    it("should warn when a discovered source file has no built output", () => {
      // given — source present, nothing built from it
      writeFileSync(join(sourceDir, "script.ts"), TYPED_INPUTS_TS);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      // when
      injectMetadataForSourceDir();

      // then
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]![0]).toContain(join(buildDir, SCRIPT_JS_FILENAME));
      warnSpy.mockRestore();
    });
  });
});

describe("injectScriptMetadata across several source directories", () => {
  let tempDir: string;
  let buildDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devtools-metadata-multiroot-test-"));
    buildDir = join(tempDir, "build");
    mkdirSync(buildDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeFileCreatingDirectories(filePath: string, contents: string): string {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
    return filePath;
  }

  it("should inject metadata for every entry point regardless of which source directory it came from", () => {
    // given — two roots, one of them with a nested output path
    const firstSource = writeFileCreatingDirectories(
      join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_DIR_NAME, FIRST_SCRIPT_FILE), TYPED_INPUTS_TS);
    const secondSource = writeFileCreatingDirectories(
      join(tempDir, SECOND_SCRIPT_ROOT_LABEL, SRC_DIR_NAME, NESTED_DIRECTORY, NESTED_SCRIPT_FILE), TYPED_INPUTS_TS);
    const firstOutput = join(buildDir, FIRST_SCRIPT_ROOT_LABEL, FIRST_SCRIPT_OUTPUT_FILE);
    const secondOutput = join(buildDir, SECOND_SCRIPT_ROOT_LABEL, NESTED_DIRECTORY, NESTED_SCRIPT_OUTPUT_FILE);
    writeFileCreatingDirectories(firstOutput, TYPED_INPUTS_JS);
    writeFileCreatingDirectories(secondOutput, TYPED_INPUTS_JS);

    // when
    injectScriptMetadata({
      buildDir,
      entryPoints: [
        { in: firstSource, out: `${FIRST_SCRIPT_ROOT_LABEL}/first-script` },
        { in: secondSource, out: `${SECOND_SCRIPT_ROOT_LABEL}/${NESTED_DIRECTORY}/nested-script` },
      ],
    });

    // then
    expect(readFileSync(firstOutput, "utf-8")).toContain(EXPECTED_PARAM_TYPES);
    expect(readFileSync(secondOutput, "utf-8")).toContain(EXPECTED_PARAM_TYPES);
  });

  it("should warn when the built output for an entry point is missing", () => {
    // given
    const source = writeFileCreatingDirectories(
      join(tempDir, FIRST_SCRIPT_ROOT_LABEL, SRC_DIR_NAME, FIRST_SCRIPT_FILE), TYPED_INPUTS_TS);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // when
    injectScriptMetadata({ buildDir, entryPoints: [{ in: source, out: `${FIRST_SCRIPT_ROOT_LABEL}/first-script` }] });

    // then
    expect(warnSpy).toHaveBeenCalledOnce();
    const warning = warnSpy.mock.calls[0]![0] as string;
    expect(warning).toContain(join(buildDir, FIRST_SCRIPT_ROOT_LABEL, FIRST_SCRIPT_OUTPUT_FILE));
    expect(warning).toContain(source);
    warnSpy.mockRestore();
  });
});
