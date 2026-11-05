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

import { readFileSync } from "fs";
import { relative, resolve } from "path";

import { transform, type BuildResult } from "esbuild";

import { listTypeScriptSourceFiles } from "./entryPoints.js";
import { toForwardSlashes } from "./forwardSlashes.js";

/**
 * Warns once about every `.ts` file with runtime code in the source directories that no built script
 * contains.
 *
 * Since only files declaring an entry function are built as scripts, a script whose entry function
 * is mistyped is no longer an entry point — and, imported by nobody, it would silently produce no
 * output at all. This is what keeps that loud. The same warning covers a helper module no script
 * imports yet. A module holding only type declarations is never warned about: esbuild elides its
 * import along with the types, so no metafile names it although the scripts use it.
 *
 * Which files the scripts contain is read from the builds' metafiles, so it requires `metafile: true`
 * — without it nothing can be said and the warning names that instead of reporting every source
 * file as unused.
 *
 * @param sourceDirs The configured script source directories, listed in full — helper modules included.
 * @param buildResults The results of every output group's build.
 */
export async function warnAboutUnusedSourceFiles(sourceDirs: string[], buildResults: BuildResult[]): Promise<void> {
  const resultsWithoutMetafile = buildResults.filter((buildResult) => buildResult.metafile === undefined);
  if (resultsWithoutMetafile.length > 0) {
    console.warn(
      `[unused-sources] ${resultsWithoutMetafile.length} of ${buildResults.length} build(s) produced no ` +
      `metafile, so it is unknown which source files were built. Set "metafile: true" on the build options.`
    );
    return;
  }
  const builtSourceFiles = collectInputsOfEveryOutput(buildResults);
  const sourceFilesInNoOutput = sourceDirs
    .flatMap(listTypeScriptSourceFiles)
    .map(toCwdRelativePath)
    .filter((sourceFile) => !builtSourceFiles.has(sourceFile));
  const unusedSourceFiles = await keepFilesHoldingRuntimeCode(sourceFilesInNoOutput);
  if (unusedSourceFiles.length === 0) {
    return;
  }
  console.warn(
    `[unused-sources] ${unusedSourceFiles.length} source file(s) are unused - no built ` +
    `script contains them:\n` +
    unusedSourceFiles.map((sourceFile) => `  ${sourceFile}\n`).join("") +
    `  A script is built only when it declares a top-level "function execute"; every other module\n` +
    `  reaches the output through a script that imports it. Each file above is therefore either a\n` +
    `  script with a mistyped entry function, or dead code no script imports.`
  );
}

/** Only a file that transpiles to some JavaScript can be missing from the output; type declarations never reach it. */
async function keepFilesHoldingRuntimeCode(sourceFiles: string[]): Promise<string[]> {
  const holdsRuntimeCodeVerdicts = await Promise.all(sourceFiles.map(holdsRuntimeCode));
  return sourceFiles.filter((_, index) => holdsRuntimeCodeVerdicts[index]);
}

async function holdsRuntimeCode(sourceFile: string): Promise<boolean> {
  try {
    // esbuild's TypeScript loader strips every type declaration, so what is left is the runtime code.
    const { code } = await transform(readFileSync(sourceFile, "utf-8"), { loader: "ts" });
    return code.trim() !== "";
  } catch {
    // A file that cannot be read or parsed is reported rather than passed over silently.
    return true;
  }
}

/** Every source file that contributed to a built file, across all output groups. */
function collectInputsOfEveryOutput(buildResults: BuildResult[]): Set<string> {
  const outputs = buildResults.flatMap((buildResult) => Object.values(buildResult.metafile?.outputs ?? {}));
  return new Set(outputs.flatMap((output) => Object.keys(output.inputs).map(toCwdRelativePath)));
}

/** The one path shape the listing and the metafiles are compared in, on every platform. */
function toCwdRelativePath(path: string): string {
  return toForwardSlashes(relative(process.cwd(), resolve(path)));
}
