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

// Source maps use VLQ (Variable-Length Quantity) encoding for compact segment mappings.
// Each segment encodes up to 5 fields as relative deltas from the previous segment's value:
//   [generatedColumn, sourceIndex, sourceLine, sourceColumn, nameIndex]

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { decode as vlqDecode, encode as vlqEncode } from "vlq";

// Matches both "data:application/json;base64," (esbuild) and
// "data:application/json;charset=utf-8;base64," (webpack).
const SOURCE_MAP_URL_MARKER = "//# sourceMappingURL=data:application/json;";
const BASE64_MARKER = "base64,";

interface SourceMap {
  sources: string[];
  sourcesContent?: (string | null)[];
  mappings: string;
}

/**
 * Scans `buildDir` recursively for `.js` files with inline base64 source maps and removes
 * any sources whose path includes `node_modules`, re-encoding the VLQ mappings accordingly.
 * Files are rewritten in place. Handles both esbuild (`data:application/json;base64,`) and
 * webpack (`data:application/json;charset=utf-8;base64,`) source map URL formats.
 *
 * @example
 * import { stripNodeModulesFromSourceMaps } from "@com.mgmtp.a12.scripting/business-scripting-devtools"
 *
 * // Call after your bundler has written output to ./build:
 * stripNodeModulesFromSourceMaps("./build")
 */
export function stripNodeModulesFromSourceMaps(buildDir: string): void {
  for (const fileName of readdirSync(buildDir, { recursive: true })) {
    if (typeof fileName !== "string" || !fileName.endsWith(".js")) { continue; }

    const filePath = join(buildDir, fileName);
    const fileContent = readFileSync(filePath, "utf-8");
    const markerStart = fileContent.lastIndexOf(SOURCE_MAP_URL_MARKER);
    if (markerStart === -1) { continue; }

    const base64MarkerIndex = fileContent.indexOf(BASE64_MARKER, markerStart);
    if (base64MarkerIndex === -1) { continue; }

    const base64Start = base64MarkerIndex + BASE64_MARKER.length;
    const lineEnd = fileContent.indexOf("\n", base64Start);
    const originalBase64 = fileContent.substring(base64Start, lineEnd === -1 ? undefined : lineEnd);

    const sourceMapJson = Buffer.from(originalBase64, "base64").toString("utf-8");
    const cleanedJson = removeNodeModulesSources(sourceMapJson);
    const cleanedBase64 = Buffer.from(cleanedJson).toString("base64");

    writeFileSync(
      filePath,
      fileContent.substring(0, base64Start) +
        cleanedBase64 +
        (lineEnd === -1 ? "" : fileContent.substring(lineEnd)),
    );
  }
}

/**
 * Removes node_modules sources from a source map JSON, remapping VLQ-encoded mappings.
 * Source map segments use delta encoding: each field is relative to the previous segment's value.
 * When sources are removed, we must re-encode the deltas against only the kept segments.
 */
function removeNodeModulesSources(sourceMapJson: string): string {
  const sourceMap = JSON.parse(sourceMapJson) as SourceMap;

  // Build a mapping from original source indices to new (compacted) indices,
  // keeping only sources that are not from node_modules.
  const oldToNewSourceIndex = new Map<number, number>();
  let compactedIndex = 0;
  for (let i = 0; i < sourceMap.sources.length; i++) {
    if (!sourceMap.sources[i]?.includes("node_modules")) {
      oldToNewSourceIndex.set(i, compactedIndex++);
    }
  }

  if (oldToNewSourceIndex.size === sourceMap.sources.length) {
    return sourceMapJson;
  }

  sourceMap.sources = sourceMap.sources.filter((_, i) => oldToNewSourceIndex.has(i));
  if (sourceMap.sourcesContent) {
    sourceMap.sourcesContent = sourceMap.sourcesContent.filter((_, i) => oldToNewSourceIndex.has(i));
  }

  sourceMap.mappings = remapMappings(sourceMap.mappings, oldToNewSourceIndex);
  return JSON.stringify(sourceMap);
}

/**
 * Re-encodes VLQ mappings, dropping segments that reference removed sources
 * and adjusting source indices to match the compacted sources array.
 */
function remapMappings(mappingsStr: string, oldToNewSourceIndex: Map<number, number>): string {
  const outputLines: string[] = [];

  // Absolute positions track where we are as we decode the original mappings.
  // VLQ fields are deltas relative to these running totals.
  let absoluteSourceIndex = 0;
  let absoluteSourceLine = 0;
  let absoluteSourceColumn = 0;
  let absoluteNameIndex = 0;

  // "Last emitted" positions track the values from the last segment we kept.
  // New delta values for kept segments are computed relative to these.
  let lastEmittedSourceIndex = 0;
  let lastEmittedSourceLine = 0;
  let lastEmittedSourceColumn = 0;
  let lastEmittedNameIndex = 0;

  for (const mappingLine of mappingsStr.split(";")) {
    if (!mappingLine) {
      outputLines.push("");
      continue;
    }

    const keptSegments: string[] = [];
    // Generated column resets per line (semicolon) in source maps.
    let absoluteGeneratedColumn = 0;
    let lastEmittedGeneratedColumn = 0;

    for (const segmentStr of mappingLine.split(",")) {
      if (!segmentStr) { continue; }
      const fields = vlqDecode(segmentStr);

      // Field 0: generated column delta (always present)
      absoluteGeneratedColumn += fields[0]!;

      // Segments with only 1 field map a generated column with no source info.
      if (fields.length === 1) {
        keptSegments.push(vlqEncode(absoluteGeneratedColumn - lastEmittedGeneratedColumn));
        lastEmittedGeneratedColumn = absoluteGeneratedColumn;
        continue;
      }

      // Fields 1-3: source index, source line, source column (all deltas)
      absoluteSourceIndex += fields[1]!;
      absoluteSourceLine += fields[2]!;
      absoluteSourceColumn += fields[3]!;

      // Field 4 (optional): name index delta
      let resolvedNameIndex: number | undefined;
      if (fields.length >= 5) {
        absoluteNameIndex += fields[4]!;
        resolvedNameIndex = absoluteNameIndex;
      }

      // Skip segments referencing removed (node_modules) sources
      if (!oldToNewSourceIndex.has(absoluteSourceIndex)) { continue; }

      const remappedSourceIndex = oldToNewSourceIndex.get(absoluteSourceIndex)!;
      const segmentFields = [
        absoluteGeneratedColumn - lastEmittedGeneratedColumn,
        remappedSourceIndex - lastEmittedSourceIndex,
        absoluteSourceLine - lastEmittedSourceLine,
        absoluteSourceColumn - lastEmittedSourceColumn,
      ];

      if (resolvedNameIndex !== undefined) {
        segmentFields.push(resolvedNameIndex - lastEmittedNameIndex);
        lastEmittedNameIndex = resolvedNameIndex;
      }

      lastEmittedGeneratedColumn = absoluteGeneratedColumn;
      lastEmittedSourceIndex = remappedSourceIndex;
      lastEmittedSourceLine = absoluteSourceLine;
      lastEmittedSourceColumn = absoluteSourceColumn;
      keptSegments.push(vlqEncode(segmentFields));
    }
    outputLines.push(keptSegments.join(","));
  }
  return outputLines.join(";");
}