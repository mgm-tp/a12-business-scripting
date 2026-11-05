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

import {existsSync, readFileSync, writeFileSync} from "fs";
import {join} from "path";

import {type EntryPoint} from "./entryPoints.js";
import {signatureRegex} from "./regex.js";

const ENTRY_FUNCTION_NAME = "execute";

function extractInterfaceProps(tsSource: string, interfaceName: string): Record<string, string> | null {
  const sourceWithoutComments = tsSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  const body = extractInterfaceBody(sourceWithoutComments, interfaceName);
  return body !== null ? parseInterfaceProperties(body) : null;
}

function buildParamTypesLine(tsSource: string, functionName: string, paramsStr: string): string | null {
  const paramTypeMatch = paramsStr.trim().match(/^\w+\s*:\s*(\w+)/);
  if (!paramTypeMatch) { return null; }
  const props = extractInterfaceProps(tsSource, paramTypeMatch[1]!);
  if (!props || Object.keys(props).length === 0) { return null; }
  return `${functionName}.__paramTypes = ${JSON.stringify(props)};`;
}

function buildReturnPropertiesLine(tsSource: string, functionName: string, returnTypeRaw: string): string | null {
  let returnType = returnTypeRaw.trim();
  const promiseMatch = returnType.match(/^Promise\s*<\s*(.+?)\s*>$/);
  if (promiseMatch) { returnType = promiseMatch[1]!; }
  if (returnType === "void") { return null; }
  const props = extractInterfaceProps(tsSource, returnType);
  if (!props || Object.keys(props).length === 0) { return null; }
  return `${functionName}.__returnProperties = ${JSON.stringify(props)};`;
}

/**
 * Post-build transformation for A12 business scripts: reads each `.ts` source file, extracts the
 * `execute` function signature, and writes the following into the corresponding built `.js` file
 * in `buildDir`:
 * - `__paramTypes` — a `Record<string, string>` mapping input parameter property names to their types
 *   (only injected when the function has a single typed-interface parameter)
 * - `__returnProperties` — a `Record<string, string>` mapping return interface property names to types
 *   (only injected when the function returns a named interface)
 *
 * `entryPoints` are the `{ in, out }` pairs handed to the bundler, so each built file is matched to
 * the exact source it came from rather than guessed from its path. Derive them with
 * `discoverEntryPoints`, which owns that mapping for any number of source directories.
 *
 * @example
 * import {
 *   discoverEntryPoints,
 *   injectScriptMetadata,
 * } from "@com.mgmtp.a12.scripting/business-scripting-devtools"
 *
 * // Call after your bundler has written output to ./build:
 * injectScriptMetadata({
 *   buildDir: "./build",
 *   entryPoints: discoverEntryPoints("./src"),
 * })
 */
export function injectScriptMetadata(
  { buildDir, entryPoints }: { buildDir: string; entryPoints: EntryPoint[] }
): void {
  for (const entryPoint of entryPoints) {
    injectMetadataIntoBuiltFile(entryPoint.in, join(buildDir, `${entryPoint.out}.js`));
  }
}

function injectMetadataIntoBuiltFile(tsPath: string, jsPath: string): void {
  if (!existsSync(jsPath)) {
    console.warn(
      `[script-metadata] No built output at ${jsPath} for source ${tsPath}.\n` +
      `  Input and output types cannot be injected, so calling the script with parameters or\n` +
      `  reading its result will fail at runtime. This means the bundler did not emit the file.`
    );
    return;
  }

  const tsSource = readFileSync(tsPath, "utf-8");
  const sigMatch = tsSource.match(signatureRegex);
  if (!sigMatch) { return; }

  const [, paramsStr, returnTypeRaw] = sigMatch;

  const metadataLines = [
    paramsStr?.trim() ? buildParamTypesLine(tsSource, ENTRY_FUNCTION_NAME, paramsStr) : null,
    returnTypeRaw ? buildReturnPropertiesLine(tsSource, ENTRY_FUNCTION_NAME, returnTypeRaw) : null,
  ].filter((line): line is string => line !== null);

  const jsContent = readFileSync(jsPath, "utf-8");
  const sourceMapIndex = jsContent.lastIndexOf("//# sourceMappingURL=");
  const suffix = `\n${metadataLines.join("\n")}\n`;

  writeFileSync(jsPath, sourceMapIndex !== -1
    ? jsContent.substring(0, sourceMapIndex) + suffix + jsContent.substring(sourceMapIndex)
    : jsContent + suffix);
}

function countBraceDepthChange(text: string): number {
    let depth = 0;
    for (const ch of text) {
        if (ch === "{") { depth++; }
        else if (ch === "}") { depth--; }
    }
    return depth;
}

function extractInterfaceBody(source: string, interfaceName: string): string | null {
    const headerPattern = new RegExp(`interface\\s+${interfaceName}\\s*\\{`);
    const headerMatch = source.match(headerPattern);
    if (!headerMatch || headerMatch.index === undefined) { return null; }

    const start = headerMatch.index + headerMatch[0].length;
    let depth = 1;
    for (let i = start; i < source.length; i++) {
        if (source[i] === "{") { depth++; }
        else if (source[i] === "}") {
            depth--;
            if (depth === 0) { return source.slice(start, i); }
        }
    }
    return null;
}

function parseInterfaceProperties(body: string): Record<string, string> {
    const props: Record<string, string> = {};
    const lines = body.split("\n").map(line => line.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        // Matches `propertyName?: type` — group 1 = name, group 2 = type fragment on this line.
        const propertyLineMatch = lines[i]!.match(/^(\w+\??)\s*:\s*(.*)/);
        if (!propertyLineMatch) { continue; }

        const propertyName = propertyLineMatch[1]!;
        const inlineTypeFragment = propertyLineMatch[2]!.replace(/[;,]$/, "").trim();
        const typeFragments = inlineTypeFragment ? [inlineTypeFragment] : [];
        let openBraceCount = countBraceDepthChange(inlineTypeFragment);

        // Type spans multiple lines (e.g. `nested: {\n  inner: string\n}`): consume continuation lines.
        while (openBraceCount > 0 && i + 1 < lines.length) {
            i++;
            const continuationFragment = lines[i]!.replace(/[;,]$/, "").trim();
            if (continuationFragment) { typeFragments.push(continuationFragment); }
            openBraceCount += countBraceDepthChange(lines[i]!);
        }

        // Join fragments and collapse any extra whitespace introduced by the line split.
        const resolvedType = typeFragments.join(" ").replace(/\s+/g, " ").trim();
        if (resolvedType) { props[propertyName] = resolvedType; }
    }

    return props;
}