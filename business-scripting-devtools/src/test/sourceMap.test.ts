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
import { join } from "path";
import { tmpdir } from "os";

import { decode as vlqDecode } from "vlq";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { stripNodeModulesFromSourceMaps } from "../sourceMap.js";

const ESBUILD_SOURCE_MAP_PREFIX = "//# sourceMappingURL=data:application/json;base64,";
const WEBPACK_SOURCE_MAP_PREFIX = "//# sourceMappingURL=data:application/json;charset=utf-8;base64,";
const SCRIPT_FILE = "script.js";
const UTF8_ENCODING = "utf-8";
const SOURCE_MAP_VERSION = 3;
const SOURCE_A = "src/a.ts";
const SOURCE_B = "src/b.ts";
const NODE_MODULES_LIB = "node_modules/lib.js";
const CONTENT_A = "content-a";
const CONTENT_B = "content-b";
const MAPPINGS_THREE_SOURCES = "AAAA,CCAA,CCAA";
const MAPPINGS_TWO_SOURCES = "AAAA,CCAA";

function buildJsWithSourceMap(sourceMap: object, prefix = ESBUILD_SOURCE_MAP_PREFIX): string {
  const base64 = Buffer.from(JSON.stringify(sourceMap)).toString("base64");
  return `var x = 1;\n${prefix}${base64}\n`;
}

function parseSourceMapFromJs(jsContent: string): Record<string, unknown> {
  const markerIdx = jsContent.lastIndexOf("//# sourceMappingURL=data:application/json;");
  const base64MarkerIdx = jsContent.indexOf("base64,", markerIdx);
  const base64 = jsContent.substring(base64MarkerIdx + "base64,".length).trim();
  return JSON.parse(Buffer.from(base64, "base64").toString(UTF8_ENCODING)) as Record<string, unknown>;
}

describe("stripNodeModulesFromSourceMaps", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devtools-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should leave a script built without a source map untouched", () => {
    // given — this is every script of a build with the source maps switched off
    const scriptPath = join(tempDir, SCRIPT_FILE);
    const scriptWithoutSourceMap = "var x = 1;\nexport { execute };\n";
    writeFileSync(scriptPath, scriptWithoutSourceMap);

    // when
    stripNodeModulesFromSourceMaps(tempDir);

    // then
    expect(readFileSync(scriptPath, UTF8_ENCODING)).toBe(scriptWithoutSourceMap);
  });

  it("should remove node_modules sources and adjust segment indices", () => {
    // given — three sources, middle one is node_modules; each segment references one source
    // "AAAA" -> source 0, "CCAA" -> source 1 (node_modules), "CCAA" -> source 2
    const sourceMap = {
      version: SOURCE_MAP_VERSION,
      sources: [SOURCE_A, NODE_MODULES_LIB, SOURCE_B],
      sourcesContent: [CONTENT_A, null, CONTENT_B],
      mappings: MAPPINGS_THREE_SOURCES,
    };
    writeFileSync(join(tempDir, SCRIPT_FILE), buildJsWithSourceMap(sourceMap));

    // when
    stripNodeModulesFromSourceMaps(tempDir);

    // then
    const result = parseSourceMapFromJs(readFileSync(join(tempDir, SCRIPT_FILE), UTF8_ENCODING));
    expect(result["sources"]).toEqual([SOURCE_A, SOURCE_B]);
    expect(result["sourcesContent"]).toEqual([CONTENT_A, CONTENT_B]);
  });

  it("should drop segments referencing removed sources and rebase deltas of kept segments", () => {
    // given — same three-source map as above
    const sourceMap = {
      version: SOURCE_MAP_VERSION,
      sources: [SOURCE_A, NODE_MODULES_LIB, SOURCE_B],
      sourcesContent: [CONTENT_A, null, CONTENT_B],
      mappings: MAPPINGS_THREE_SOURCES,
    };
    writeFileSync(join(tempDir, SCRIPT_FILE), buildJsWithSourceMap(sourceMap));

    // when
    stripNodeModulesFromSourceMaps(tempDir);

    // then — two segments remain; the third segment's sourceIndex delta must be rebased
    // against the last kept segment (source 0), so its new delta resolves to new index 1
    const result = parseSourceMapFromJs(readFileSync(join(tempDir, SCRIPT_FILE), UTF8_ENCODING));
    const segments = (result["mappings"] as string).split(",").map((s) => vlqDecode(s));
    expect(segments).toHaveLength(2);
    // first kept segment: genCol=0, srcIdx=0, srcLine=0, srcCol=0 (unchanged)
    expect(segments[0]).toEqual([0, 0, 0, 0]);
    // second kept segment: genCol delta=2 (skipped node_modules segment's column),
    // srcIdx delta=1 (absolute index was 2, remapped to 1, last emitted was 0)
    expect(segments[1]).toEqual([2, 1, 0, 0]);
  });

  it("should not modify sources when no node_modules sources are present", () => {
    // given
    const sourceMap = {
      version: SOURCE_MAP_VERSION,
      sources: [SOURCE_A, SOURCE_B],
      sourcesContent: [CONTENT_A, CONTENT_B],
      mappings: MAPPINGS_TWO_SOURCES,
    };
    writeFileSync(join(tempDir, SCRIPT_FILE), buildJsWithSourceMap(sourceMap));

    // when
    stripNodeModulesFromSourceMaps(tempDir);

    // then
    const result = parseSourceMapFromJs(readFileSync(join(tempDir, SCRIPT_FILE), UTF8_ENCODING));
    expect(result["sources"]).toEqual([SOURCE_A, SOURCE_B]);
  });

  it("should rewrite the .js file with the cleaned source map", () => {
    // given
    const sourceMap = {
      version: SOURCE_MAP_VERSION,
      sources: [SOURCE_A, NODE_MODULES_LIB],
      sourcesContent: [CONTENT_A, null],
      mappings: MAPPINGS_TWO_SOURCES,
    };
    const originalContent = buildJsWithSourceMap(sourceMap);
    writeFileSync(join(tempDir, SCRIPT_FILE), originalContent);

    // when
    stripNodeModulesFromSourceMaps(tempDir);

    // then
    const updatedContent = readFileSync(join(tempDir, SCRIPT_FILE), UTF8_ENCODING);
    expect(updatedContent).not.toEqual(originalContent);
    expect(parseSourceMapFromJs(updatedContent)["sources"]).toEqual([SOURCE_A]);
  });

  it("should strip node_modules sources from a source map with charset=utf-8 URL format (webpack)", () => {
    // given — webpack emits "data:application/json;charset=utf-8;base64," instead of esbuild's "data:application/json;base64,"
    const sourceMap = {
      version: SOURCE_MAP_VERSION,
      sources: [SOURCE_A, NODE_MODULES_LIB],
      sourcesContent: [CONTENT_A, null],
      mappings: MAPPINGS_TWO_SOURCES,
    };
    writeFileSync(join(tempDir, SCRIPT_FILE), buildJsWithSourceMap(sourceMap, WEBPACK_SOURCE_MAP_PREFIX));

    // when
    stripNodeModulesFromSourceMaps(tempDir);

    // then
    const result = parseSourceMapFromJs(readFileSync(join(tempDir, SCRIPT_FILE), UTF8_ENCODING));
    expect(result["sources"]).toEqual([SOURCE_A]);
  });
});
