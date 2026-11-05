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

import { exec } from "child_process";

import { ENGINE_SYNTAX_TARGET } from "./engineEcmaScriptLevel.js";

const SHOW_CONFIG_COMMAND = "npx --no-install tsc --showConfig";
const ECMASCRIPT_LEVEL_PATTERN = /^es(\d{4})$/;
/** Libraries typing the APIs of a browser or another host, such as `setTimeout` or `fetch`, which GraalJS lacks. */
const HOST_LIBRARY_PATTERN = /^(dom|webworker|scripthost)(\.|$)/;
/** Without `lib`, TypeScript type-checks against the DOM besides the target's level, whatever the target. */
const IMPLICIT_HOST_LIBRARY = "dom (TypeScript's default without lib)";
/** `--showConfig` output grows with every `extends` and `files` entry, so allow for a large project. */
const SHOW_CONFIG_MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

/** The subset of the resolved `tsconfig.json` that decides which built-ins a type check accepts. */
interface LibraryRelevantCompilerOptions {
  lib?: string[];
  target?: string;
}

/**
 * Warns when the type check accepts built-ins the script engine does not implement.
 *
 * The esbuild `target` pins the syntax level, but built-ins are library features: esbuild neither
 * lowers nor polyfills them, so a script calling one above that level builds cleanly and fails at
 * evaluation time. What rejects them is the type checker's `lib` level, and that lives in the
 * consumer's `tsconfig.json` — which this cannot change, only report on.
 *
 * Warns instead of failing: the level is read from the default `tsconfig.json`, while the configured
 * type-check command may check another project entirely, so a mismatch is a strong hint and not a
 * certainty. A level that cannot be read is reported too, rather than passing as compliant.
 */
export async function warnAboutLibraryLevel(): Promise<void> {
  const compilerOptions = await readResolvedCompilerOptions();
  if (compilerOptions === undefined) {
    return;
  }
  const librariesTheEngineLacks = findLibrariesTheEngineLacks(compilerOptions);
  if (librariesTheEngineLacks.length === 0) {
    return;
  }
  console.warn(
    `[type-checker-libraries] the type check accepts ` +
    `${librariesTheEngineLacks.map((library) => `"${library}"`).join(", ")}, whose built-ins the ` +
    `script engine does not implement: it implements ${ENGINE_SYNTAX_TARGET} and no browser or Node API.\n` +
    `  Such built-ins type-check and build, but fail at runtime: unlike syntax, they are neither\n` +
    `  transpiled down nor polyfilled.\n` +
    `  Set "lib": ["${ENGINE_SYNTAX_TARGET}"] in tsconfig.json to have the type check reject them.`
  );
}

/**
 * The libraries of the resolved compiler options whose built-ins the engine does not implement: an
 * ECMAScript level above the engine's, or a host library such as the DOM.
 *
 * `lib` decides this where it is set. Sub-libraries count: `"esnext.temporal"` alone admits
 * `Temporal`. Without `lib`, TypeScript checks against the `target`'s level plus the DOM, so the DOM
 * is always named there.
 */
export function findLibrariesTheEngineLacks(compilerOptions: LibraryRelevantCompilerOptions): string[] {
  if (compilerOptions.lib === undefined) {
    const targetLevel = compilerOptions.target === undefined ? [] : [compilerOptions.target];
    return [...targetLevel.filter(isAboveTheEngineLevel), IMPLICIT_HOST_LIBRARY];
  }
  return compilerOptions.lib.filter((library) => isAboveTheEngineLevel(library) || isHostLibrary(library));
}

function isHostLibrary(library: string): boolean {
  return HOST_LIBRARY_PATTERN.test(library.toLowerCase());
}

function isAboveTheEngineLevel(library: string): boolean {
  const normalizedLibrary = library.toLowerCase();
  if (normalizedLibrary === "esnext" || normalizedLibrary.startsWith("esnext.")) {
    return true;
  }
  const ecmaScriptYear = readEcmaScriptYear(normalizedLibrary);
  return ecmaScriptYear !== undefined && ecmaScriptYear > engineEcmaScriptYear();
}

function readEcmaScriptYear(library: string): number | undefined {
  const ecmaScriptYear = ECMASCRIPT_LEVEL_PATTERN.exec(library)?.[1];
  return ecmaScriptYear === undefined ? undefined : Number(ecmaScriptYear);
}

/** The pinned target as a comparable year. A pin no level can be read from would compare against nothing. */
function engineEcmaScriptYear(): number {
  const engineYear = readEcmaScriptYear(ENGINE_SYNTAX_TARGET);
  if (engineYear === undefined) {
    throw new Error(`the pinned engine syntax target "${ENGINE_SYNTAX_TARGET}" names no ECMAScript level`);
  }
  return engineYear;
}

/**
 * The compiler options of the default `tsconfig.json` as TypeScript itself resolves them, `extends`
 * chains included. Absent — with a warning naming why — when no TypeScript is installed to ask, the
 * project has no default `tsconfig.json`, or the output is not the expected JSON.
 */
async function readResolvedCompilerOptions(): Promise<LibraryRelevantCompilerOptions | undefined> {
  const showConfigOutput = await runShowConfig();
  if (showConfigOutput === undefined) {
    return undefined;
  }
  try {
    const resolvedConfig: unknown = JSON.parse(showConfigOutput);
    if (typeof resolvedConfig !== "object" || resolvedConfig === null || !("compilerOptions" in resolvedConfig)) {
      return {};
    }
    return resolvedConfig.compilerOptions as LibraryRelevantCompilerOptions;
  } catch (error) {
    warnAboutUnreadableLevel(`its output is not valid JSON: ${String(error)}`);
    return undefined;
  }
}

function runShowConfig(): Promise<string | undefined> {
  return new Promise((resolve) => {
    exec(SHOW_CONFIG_COMMAND, { maxBuffer: SHOW_CONFIG_MAX_OUTPUT_BYTES }, (error, stdout, stderr) => {
      if (error !== null) {
        warnAboutUnreadableLevel(stderr.trim() === "" ? error.message : stderr.trim());
        resolve(undefined);
        return;
      }
      resolve(stdout);
    });
  });
}

function warnAboutUnreadableLevel(reason: string): void {
  console.warn(
    `[type-checker-libraries] could not read the type check's library level via ` +
    `"${SHOW_CONFIG_COMMAND}", so it is unknown whether the type check rejects built-ins the script ` +
    `engine lacks: ${reason}`
  );
}
