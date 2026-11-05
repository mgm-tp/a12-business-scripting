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

import { basename, join } from "path";

import type { Plugin } from "esbuild";
import { context as esbuildContext } from "esbuild";

import { combineBuildContexts, type CombinedBuildContext } from "./combinedBuildContext.js";
import { ENGINE_SYNTAX_TARGET } from "./engineEcmaScriptLevel.js";
import { discoverEntryPointGroups, type EntryPoint, type EntryPointGroup } from "./entryPoints.js";
import { type SourceMapsSetting } from "./sourceMapsSetting.js";

/**
 * Filename template for the chunk holding the code an output group's scripts share.
 *
 * The `shared-lib-` prefix is how the runtime tells a chunk apart from a registerable script: it must
 * stay in sync with the `mgmtp.a12.scripting.chunk-name-prefixes` default in `ScriptingProperties`,
 * otherwise the chunk is registered as a script and every script that imports it fails to load.
 */
export const SHARED_CHUNK_NAME_TEMPLATE = "shared-lib-[hash]";

/**
 * The scripts run on GraalJS, which is neither a browser nor Node: esbuild's default platform would
 * resolve a package's browser variant, and `node` would leave Node built-ins for the engine to fail on.
 */
const ENGINE_PLATFORM = "neutral";

/**
 * A neutral platform resolves no `package.json` entry field on its own, so a package declaring no
 * `exports` would not resolve at all. Module first, so a package's ESM build wins over its CommonJS one.
 */
const PACKAGE_ENTRY_FIELDS = ["module", "main"];

/** How an output group is built, apart from the entry points it consists of. */
interface OutputGroupBuildSettings {
  buildDir: string;
  /** Whether the code a group's scripts share becomes a chunk instead of being inlined into each of them. */
  splitting: boolean;
  /** Whether the built scripts carry an inline source map. */
  sourceMaps: SourceMapsSetting;
  /**
   * Called per group with the group and its output directory, so plugins that write output can be
   * scoped to that directory instead of the whole build directory.
   */
  createPlugins: (entryPointGroup: EntryPointGroup, groupOutputDirectory: string) => Plugin[];
}

/**
 * Creates one esbuild context per output group and combines them into a single one.
 *
 * Each context writes to its own subdirectory of `buildDir`, which is what keeps a group's shared
 * chunk next to the scripts importing it instead of at the build root, and therefore inside the
 * script location the runtime allows them to read from. Code is only shared within a group, and a
 * group holding a single script gets no chunk at all. Without `splitting` no chunk is written and
 * every script carries its own copy of the shared code.
 *
 * The groups are discovered here rather than taken from a caller-supplied entry-point list, so a
 * script added during a watch session lands in the right group and both collision checks run again.
 */
export async function createCombinedBuildContextPerOutputGroup(
  options: OutputGroupBuildSettings & { sourceDirs: string[] }
): Promise<CombinedBuildContext> {
  const entryPointGroups = discoverEntryPointGroups(options.sourceDirs);
  assertNoDuplicateOutputSubdirectories(entryPointGroups);
  assertNoDuplicateScriptFilenames(entryPointGroups.flatMap((entryPointGroup) => entryPointGroup.entryPoints));
  const groupedBuildContexts = await Promise.all(
    entryPointGroups.map(async (entryPointGroup) => ({
      outputSubdirectory: entryPointGroup.outputSubdirectory,
      buildContext: await createBuildContextForGroup(entryPointGroup, options),
    }))
  );
  return combineBuildContexts(groupedBuildContexts);
}

function createBuildContextForGroup(
  entryPointGroup: EntryPointGroup,
  settings: OutputGroupBuildSettings
): Promise<CombinedBuildContext> {
  const { buildDir, splitting, sourceMaps, createPlugins } = settings;
  const groupOutputDirectory = toGroupOutputDirectory(buildDir, entryPointGroup.outputSubdirectory);
  return esbuildContext({
    entryPoints: entryPointGroup.entryPoints,
    bundle: true,
    splitting,
    // Left out without splitting: on its own the template would only rename esbuild's other output.
    ...(splitting ? { chunkNames: SHARED_CHUNK_NAME_TEMPLATE } : {}),
    format: "esm",
    platform: ENGINE_PLATFORM,
    mainFields: PACKAGE_ENTRY_FIELDS,
    target: ENGINE_SYNTAX_TARGET,
    // Left out with the maps off, where esbuild's own defaults are what emits no map at all.
    ...(sourceMaps === "inline" ? { sourcemap: "inline", sourcesContent: false } : {}),
    outdir: groupOutputDirectory,
    // Never written to disk; it is what tells the build which source files reached no script.
    metafile: true,
    logLevel: "info",
    plugins: createPlugins(entryPointGroup, groupOutputDirectory),
  });
}

/**
 * Resolves an output group's directory, keeping the build directory itself for the unprefixed group
 * of a single-source-directory setup instead of adding a level below it.
 */
function toGroupOutputDirectory(buildDir: string, outputSubdirectory: string): string {
  return outputSubdirectory === "" ? buildDir : join(buildDir, outputSubdirectory);
}

/**
 * Rejects two source directories that derive the same output subdirectory, which happens whenever
 * their labels coincide — `./teamA/scripts/src` and `./teamB/scripts/src` are both labelled `scripts`.
 * Their contexts would share one output directory and overwrite each other's scripts and chunks on
 * every rebuild, which is the collision separate output directories exist to prevent.
 */
function assertNoDuplicateOutputSubdirectories(entryPointGroups: EntryPointGroup[]): void {
  const sourceDirectoriesByOutputSubdirectory = new Map<string, string>();
  for (const entryPointGroup of entryPointGroups) {
    const previousSourceDirectory = sourceDirectoriesByOutputSubdirectory.get(entryPointGroup.outputSubdirectory);
    if (previousSourceDirectory !== undefined) {
      throw new Error(
        `duplicate output subdirectory "${entryPointGroup.outputSubdirectory}" — ${previousSourceDirectory} and ` +
        `${entryPointGroup.sourceDirectory} both build into it, so one would overwrite the other's output. ` +
        `Rename one of the directories the label is derived from.`
      );
    }
    sourceDirectoriesByOutputSubdirectory.set(entryPointGroup.outputSubdirectory, entryPointGroup.sourceDirectory);
  }
}

/**
 * Rejects two scripts that share a filename, even when they come from different source directories.
 * The runtime registers a script under its filename alone and ignores the directory it sits in, so
 * one of the two would silently shadow the other.
 */
function assertNoDuplicateScriptFilenames(entryPoints: EntryPoint[]): void {
  const sourcePathsByScriptFilename = new Map<string, string>();
  for (const entryPoint of entryPoints) {
    const scriptFilename = basename(entryPoint.out);
    const previousSourcePath = sourcePathsByScriptFilename.get(scriptFilename);
    if (previousSourcePath !== undefined) {
      throw new Error(
        `duplicate script name "${scriptFilename}" — ${previousSourcePath} and ${entryPoint.in} ` +
        `both register under that name at runtime, so one would silently replace the other. Rename one of them.`
      );
    }
    sourcePathsByScriptFilename.set(scriptFilename, entryPoint.in);
  }
}
