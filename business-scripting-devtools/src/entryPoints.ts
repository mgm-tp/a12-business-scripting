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

import { readdirSync, readFileSync } from "fs";
import { join, relative, resolve, sep } from "path";

import { toForwardSlashes } from "./forwardSlashes.js";
import { declaresEntryFunction } from "./regex.js";

const SRC_SUB_DIR_NAME = "src";
const TS_EXTENSION_PATTERN = /\.ts$/;

/** An esbuild entry point paired with the output path it must be written to, relative to `outdir` and without extension. */
export interface EntryPoint {
  in: string;
  out: string;
}

/**
 * The entry points of one source directory together with the build subdirectory they are written to.
 *
 * Each group is built by its own esbuild context with `outdir` set to that subdirectory, which is
 * what makes the shared code chunk land next to the scripts importing it instead of at the build
 * root. The chunk is therefore only shared within a group, never across groups.
 */
export interface EntryPointGroup {
  /** The source directory the group was discovered in, exactly as it was configured. */
  sourceDirectory: string;
  /** Path below the build directory, relative and without leading separator; empty for a single source directory. */
  outputSubdirectory: string;
  /** Entry points whose `out` paths are relative to `outputSubdirectory`. */
  entryPoints: EntryPoint[];
}

function isTypeScriptSourceFile(file: unknown): file is string {
  return typeof file === "string" && file.endsWith(".ts") && !file.endsWith(".d.ts");
}

/**
 * Recursively finds the scripts under each source directory — the `.ts` files declaring an `execute`
 * entry function — and pairs every one with its output path. Helper modules the scripts import are
 * left out: they reach the output as part of the bundle of every script importing them, while as an
 * entry point of their own they would be registered at runtime as a script nothing can call.
 *
 * The pairs go to esbuild as `entryPoints: [{ in, out }]` instead of relying on `outbase`, because esbuild derives `outbase`
 * from the lowest common ancestor of all entry points, which would silently shift the whole output
 * tree as soon as a second source directory is added.
 *
 * The `in` path mirrors the input path style — relative in, relative out.
 *
 * The output path is the source file's path relative to **its own** source directory, without the
 * `.ts` extension. When more than one source directory is configured it is additionally prefixed
 * with the source directory's label — its own directory name, or its parent's when it is named
 * `src` — so each source directory gets its own group in the output. A single source directory
 * produces no prefix, reproducing the output layout `outbase` produced before.
 *
 * This is the flattening of {@link discoverEntryPointGroups}, which owns the layout rule. Use the
 * grouped form when the groups must be built separately, the flat form when one list is enough.
 *
 * @example
 * import { discoverEntryPoints } from "@com.mgmtp.a12.scripting/business-scripting-devtools"
 *
 * discoverEntryPoints("./src")
 * // → [{ in: "src/nested/b-script.ts", out: "nested/b-script" }]
 *
 * discoverEntryPoints(["./first-scripts/src", "./second-scripts/src"])
 * // → [{ in: "first-scripts/src/a-script.ts",            out: "first-scripts/a-script" },
 * //    { in: "second-scripts/src/nested/b-script.ts",    out: "second-scripts/nested/b-script" }]
 */
export function discoverEntryPoints(sourceDir: string): EntryPoint[];
export function discoverEntryPoints(sourceDirs: string[]): EntryPoint[];
export function discoverEntryPoints(sourceDirOrDirs: string | string[]): EntryPoint[] {
  const sourceDirs = typeof sourceDirOrDirs === "string" ? [sourceDirOrDirs] : sourceDirOrDirs;
  return discoverEntryPointGroups(sourceDirs).flatMap((group) =>
    group.entryPoints.map((entryPoint) => ({
      in: entryPoint.in,
      out: group.outputSubdirectory === "" ? entryPoint.out : `${group.outputSubdirectory}/${entryPoint.out}`,
    }))
  );
}

/**
 * Discovers the scripts of every source directory and keeps them grouped by the build subdirectory
 * they are written to, so each group can be built by its own esbuild context. Helper modules are
 * left out, as in {@link discoverEntryPoints}.
 *
 * The grouping directory is the source directory's label — its own directory name, or its parent's
 * when it is named `src`. A single source directory produces one group with an empty subdirectory,
 * writing straight to the build directory as it did before multi-directory support. A source
 * directory without any script still yields a group, just an empty one.
 *
 * @example
 * discoverEntryPointGroups(["./first-scripts/src", "./second-scripts/src"])
 * // → [{ sourceDirectory: "./first-scripts/src",  outputSubdirectory: "first-scripts",
 * //      entryPoints: [{ in: "first-scripts/src/a-script.ts", out: "a-script" }] },
 * //    { sourceDirectory: "./second-scripts/src", outputSubdirectory: "second-scripts",
 * //      entryPoints: [{ in: "second-scripts/src/nested/b-script.ts", out: "nested/b-script" }] }]
 */
export function discoverEntryPointGroups(sourceDir: string): EntryPointGroup[];
export function discoverEntryPointGroups(sourceDirs: string[]): EntryPointGroup[];
export function discoverEntryPointGroups(sourceDirOrDirs: string | string[]): EntryPointGroup[] {
  const sourceDirs = typeof sourceDirOrDirs === "string" ? [sourceDirOrDirs] : sourceDirOrDirs;
  if (sourceDirs.length === 0) {
    throw new Error("no source directory configured — pass at least one directory containing script entry points");
  }
  const groupOutputBySourceDirectory = sourceDirs.length > 1;
  return sourceDirs.map((sourceDir) => ({
    sourceDirectory: sourceDir,
    outputSubdirectory: groupOutputBySourceDirectory ? deriveRootLabel(sourceDir) : "",
    entryPoints: listTypeScriptSourceFiles(sourceDir)
      .filter(isEntryPointSourceFile)
      .map((sourceFile) => ({
        in: sourceFile,
        out: buildOutputPath(sourceFile, sourceDir),
      })),
  }));
}

/**
 * Recursively lists every `.ts` source file under a source directory, scripts and helper modules
 * alike, excluding `.d.ts` declaration files. Exported for `unusedSources.ts` only, so the
 * reachability check reads the same listing entry-point discovery does instead of restating the rule.
 */
export function listTypeScriptSourceFiles(sourceDir: string): string[] {
  return readdirSync(sourceDir, { recursive: true })
    .filter(isTypeScriptSourceFile)
    .map((file) => join(sourceDir, file));
}

/**
 * Whether a listed source file is a script and therefore an entry point of its own, rather than a
 * helper module the scripts import — a helper built as an entry point would be written to the build
 * directory and registered at runtime as a script that cannot be called.
 *
 * A file that cannot be read counts as no entry point instead of raising: discovery runs on every
 * change of a watch session, where a file can be renamed or deleted between the listing and the read,
 * and an escaping error there ends the session.
 */
function isEntryPointSourceFile(sourceFile: string): boolean {
  try {
    return declaresEntryFunction(readFileSync(sourceFile, "utf-8"));
  } catch (error) {
    console.warn(`[entry-points] ${sourceFile} was listed but could not be read, so it is not built: ${String(error)}`);
    return false;
  }
}

function buildOutputPath(sourceFile: string, sourceDir: string): string {
  return toForwardSlashes(relative(sourceDir, sourceFile).replace(TS_EXTENSION_PATTERN, ""));
}

/**
 * Derives the grouping directory name for a source directory: its own directory name, or its
 * parent's when it is named `src`, because `src` describes no concern.
 */
function deriveRootLabel(sourceDir: string): string {
  const segments = resolve(sourceDir).split(sep).filter(Boolean);
  const ownName = segments.at(-1);
  if (ownName !== SRC_SUB_DIR_NAME) {
    return ownName ?? SRC_SUB_DIR_NAME;
  }
  return segments.at(-2) ?? SRC_SUB_DIR_NAME;
}
