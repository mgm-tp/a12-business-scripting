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

import type {Plugin} from "esbuild";

import {assertBuildDirInsideCwd, cleanBuildDir} from "./buildDirectory.js";
import {type CombinedBuildContext, toBuildResultList} from "./combinedBuildContext.js";
import {discoverEntryPoints, type EntryPoint, type EntryPointGroup} from "./entryPoints.js";
import {createCombinedBuildContextPerOutputGroup} from "./groupedBuildContexts.js";
import {createKeepEntryFunctionPlugin} from "./keepEntryFunctionPlugin.js";
import {readProductionFlagFromCommandLine, PRODUCTION_PRESET} from "./productionPreset.js";
import {injectScriptMetadata} from "./scriptMetadata.js";
import {stripNodeModulesFromSourceMaps} from "./sourceMap.js";
import {
  describeAcceptedSourceMapsSettings,
  isSourceMapsSetting,
  readSourceMapsSettingFromCommandLine,
  type SourceMapsSetting,
} from "./sourceMapsSetting.js";
import {createTypeCheckPlugin} from "./typeCheckPlugin.js";
import {warnAboutLibraryLevel} from "./typeCheckerLibraries.js";
import {warnAboutUnusedSourceFiles} from "./unusedSources.js";
import {rebuildReportingFailure, watchEsbuild} from "./watchEsbuild.js";

export {combineBuildContexts, type CombinedBuildContext, type GroupedBuildContext} from "./combinedBuildContext.js";
export {SOURCE_MAPS_SETTINGS, type SourceMapsSetting} from "./sourceMapsSetting.js";
export {PRODUCTION_PRESET} from "./productionPreset.js";
export {createKeepEntryFunctionPlugin, keepEntryFunctionPlugin} from "./keepEntryFunctionPlugin.js";
export {createTypeCheckPlugin} from "./typeCheckPlugin.js";
export {warnAboutLibraryLevel} from "./typeCheckerLibraries.js";
export {watchEsbuild} from "./watchEsbuild.js";

const DEFAULT_SOURCE_MAPS_SETTING: SourceMapsSetting = "inline";
/** Validates each setting of {@link SetupEsbuildOptions}; typed as a record so a setting added there must be added here. */
const SETUP_ESBUILD_SETTING_VALIDATORS: Record<keyof SetupEsbuildOptions, (setting: unknown) => boolean> = {
  watch: isBooleanOrAbsent,
  splitting: isBooleanOrAbsent,
  production: isBooleanOrAbsent,
  sourceMaps: isSourceMapsSettingOrAbsent,
  typeCheckCommand: isStringOrAbsent,
};

/**
 * Returns an esbuild plugin that runs script post-processing after each build.
 * Wires `injectScriptMetadata` and `stripNodeModulesFromSourceMaps` into `onEnd`
 * so consumers do not need to define this boilerplate themselves.
 *
 * Takes either `sourceDirs`, whose entry points are rediscovered after every build so scripts added
 * during a watch session are picked up, or a fixed `entryPoints` mapping.
 *
 * Post-processes nothing after a failed build, which leaves no output to scan.
 *
 * Usage: `plugins: [keepEntryFunctionPlugin, createPostBuildPlugin({ sourceDir, buildDir })]`
 */
export function createPostBuildPlugin(options: { sourceDir: string; buildDir: string }): Plugin;
export function createPostBuildPlugin(options: { sourceDirs: string[]; buildDir: string }): Plugin;
export function createPostBuildPlugin(options: { entryPoints: EntryPoint[]; buildDir: string }): Plugin;
export function createPostBuildPlugin(
  options: { sourceDir?: string; sourceDirs?: string[]; entryPoints?: EntryPoint[]; buildDir: string }
): Plugin {
  const { buildDir } = options;
  const resolveEntryPoints = createEntryPointResolver(options);
  return {
    name: "post-build",
    setup(build) {
      build.onEnd((result) => {
        // A failed build leaves no output — esbuild removes even what an earlier build wrote. Scanning
        // it anyway would bury the error that failed the build under an ENOENT of the post-processing.
        if (result.errors.length > 0) {
          return;
        }
        const entryPoints = resolveEntryPoints();
        // A group without a script writes no output directory at all, so there is nothing to scan.
        if (entryPoints.length === 0) {
          return;
        }
        injectScriptMetadata({ buildDir, entryPoints });
        stripNodeModulesFromSourceMaps(buildDir);
      });
    },
  };
}

/**
 * Turns the three accepted forms into one lookup of the entry points to post-process. A fixed
 * mapping is returned as it is; source directories are rediscovered per call, so a script added
 * during a watch session is picked up.
 */
function createEntryPointResolver(
  options: { sourceDir?: string; sourceDirs?: string[]; entryPoints?: EntryPoint[] }
): () => EntryPoint[] {
  const { sourceDir, sourceDirs, entryPoints } = options;
  const configuredSourceDirs = sourceDirs ?? (sourceDir !== undefined ? [sourceDir] : undefined);
  if (entryPoints !== undefined && configuredSourceDirs !== undefined) {
    throw new Error("exactly one of sourceDir, sourceDirs and entryPoints must be given, not both");
  }
  if (entryPoints !== undefined) {
    return () => entryPoints;
  }
  if (configuredSourceDirs !== undefined) {
    return () => discoverEntryPoints(configuredSourceDirs);
  }
  throw new Error("exactly one of sourceDir, sourceDirs and entryPoints must be given");
}

/** Optional settings of {@link setupEsbuild}. */
export interface SetupEsbuildOptions {
  /** Whether to start watch mode. Defaults to `process.argv.includes("--watch")`. */
  watch?: boolean;
  /** Whether shared code becomes a chunk instead of being inlined into every script. Defaults to `true`. */
  splitting?: boolean;
  /**
   * Whether to build for a deployment rather than for the development loop. Selects, for every
   * setting a deployment must not inherit from development, the value {@link PRODUCTION_PRESET}
   * names: `sourceMaps: "off"`. A setting given explicitly, in these options or by its own command-line flag, still wins.
   *
   * Defaults to whether `--production` is on the command line. The flag given with a value, such as
   * `--production=true`, fails the build, also where this option is set.
   */
  production?: boolean;
  /**
   * Whether every built script carries an inline source map.
   *
   * With `"inline"` — the default — a script failure reports the location in the TypeScript source
   * and a debugger steps through it. The map roughly doubles the size of the script.
   *
   * With `"off"` no map is emitted: the scripts are smaller, a failure reports no source location at
   * all, and a debugger shows the transpiled JavaScript. esbuild's comments naming each bundled
   * module's source path stay.
   *
   * Defaults to the value of `--source-maps=<inline|off>` on the command line, else to `"off"` under
   * the production preset and to `"inline"` otherwise. An explicit setting wins over the command line.
   */
  sourceMaps?: SourceMapsSetting;
  /**
   * A shell command that type-checks the scripts, run before every build — `"npm run typecheck"`
   * for the standard `tsc --noEmit` setup. A failing check writes no output at all, and in watch
   * mode also removes the output of the previous build. The output reappears once the check passes.
   * A watch session rebuilds, and so checks again, only when a file the scripts bundle changes: an
   * edit to a file that holds nothing but types is checked with the next such change.
   *
   * Setting it also warns once per run when the type check accepts built-ins the script engine lacks,
   * above its level or of a browser — see {@link warnAboutLibraryLevel}.
   *
   * Absent by default, which builds without any type check.
   */
  typeCheckCommand?: string;
}

/**
 * Runs the full esbuild build and watch lifecycle for the standard business-scripting setup.
 *
 * Discovers the scripts of every source directory and builds each source directory's group in its own
 * esbuild context with the canonical config (bundle, ESM, code splitting, a syntax level the script
 * engine can parse, inline source maps without the source text, info log level), then either starts
 * `watchEsbuild` or disposes the contexts depending on `options.watch`. `buildDir` is cleaned once up
 * front, before any context exists, so no group can delete another group's output.
 *
 * Splitting extracts the code shared by a group's scripts — most of it `business-scripting-core` —
 * into a chunk instead of inlining it into every script. Each group's context writes to its own
 * subdirectory of `buildDir`, which is what keeps that chunk next to the scripts importing it and
 * therefore inside the script location the runtime allows them to read from. Code is only shared
 * within a group, and a group holding a single script gets no chunk at all. With
 * `options.splitting: false` every script carries its own copy of the shared code instead.
 *
 * Usage: `await setupEsbuild("./src", "./build")`
 *        `await setupEsbuild(["./first-scripts/src", "./second-scripts/src"], "./build")`
 *        `await setupEsbuild("./src", "./build", { splitting: false })`
 *        `await setupEsbuild("./src", "./build", { production: true })`
 *        `await setupEsbuild("./src", "./build", { sourceMaps: "off" })`
 *        `await setupEsbuild("./src", "./build", { typeCheckCommand: "npm run typecheck" })`
 *
 * @param sourceDir Directory containing the `.ts` scripts to build.
 * @param buildDir Output directory — cleaned before each build. Must be inside `process.cwd()`.
 * @param options Watch, splitting, production, source-map and type-check settings; see {@link SetupEsbuildOptions}.
 */
export async function setupEsbuild(sourceDir: string, buildDir: string, options?: SetupEsbuildOptions): Promise<void>;
export async function setupEsbuild(sourceDirs: string[], buildDir: string, options?: SetupEsbuildOptions): Promise<void>;
export async function setupEsbuild(
  sourceDirOrDirs: string | string[],
  buildDir: string,
  options: unknown = {}
): Promise<void> {
  if (!isSetupEsbuildOptions(options)) {
    throw new Error(
      "setupEsbuild's third parameter must be an options object with the optional settings watch " +
      `(boolean), splitting (boolean), production (boolean), sourceMaps (${describeAcceptedSourceMapsSettings()}) ` +
      "and typeCheckCommand (string)"
    );
  }
  assertNoUnknownSetupEsbuildOptions(options);

  // Read before the settings so a mistyped flag is rejected even where an explicit setting wins.
  const sourceMapsFromCommandLine = readSourceMapsSettingFromCommandLine();
  const productionFromCommandLine = readProductionFlagFromCommandLine();
  const {
    watch = process.argv.includes("--watch"),
    splitting = true,
    production = productionFromCommandLine,
    typeCheckCommand,
  } = options;
  const sourceMaps = options.sourceMaps ?? sourceMapsFromCommandLine ?? defaultSourceMapsSetting(production);

  assertBuildDirInsideCwd(buildDir);

  const sourceDirs = typeof sourceDirOrDirs === "string" ? [sourceDirOrDirs] : sourceDirOrDirs;

  cleanBuildDir(buildDir);

  // Holds no state, so one instance serves every group; each group's build runs its own check.
  const typeCheckPlugins = typeCheckCommand === undefined ? [] : [createTypeCheckPlugin(typeCheckCommand)];

  // Once per run, not per rebuild: the level is a configuration file, which a watch session keeps.
  if (typeCheckCommand !== undefined) {
    await warnAboutLibraryLevel();
  }

  function createContextPerOutputGroup(): Promise<CombinedBuildContext> {
    return createCombinedBuildContextPerOutputGroup({
      sourceDirs,
      buildDir,
      splitting,
      sourceMaps,
      createPlugins: (entryPointGroup: EntryPointGroup, groupOutputDirectory: string) => [
        // First, so a group that does not type-check writes no output.
        ...typeCheckPlugins,
        // Given every source directory so a group does not warn about another group's files.
        createKeepEntryFunctionPlugin(sourceDirs),
        // Scoped to this group's output directory so groups cannot post-process each other's files.
        createPostBuildPlugin({ entryPoints: entryPointGroup.entryPoints, buildDir: groupOutputDirectory }),
      ],
    });
  }

  const ctx = await createContextPerOutputGroup();
  if (!watch) {
    try {
      await warnAboutUnusedSourceFiles(sourceDirs, toBuildResultList(await ctx.rebuild()));
      console.log("Build complete.");
    } finally {
      // An open context keeps the Node process alive, so a failed build would never exit.
      await ctx.dispose();
    }
    return;
  }
  // A failed first build does not end the session: the next edit may be the one that fixes it.
  const firstBuildResults = await rebuildReportingFailure(ctx);
  if (firstBuildResults !== undefined) {
    await warnAboutUnusedSourceFiles(sourceDirs, firstBuildResults);
    console.log("Build complete.");
  }
  console.log("Watching for changes...");
  const entryPoints = discoverEntryPoints(sourceDirs);
  await watchEsbuild({ ctx, entryPoints, sourceDirs, buildDir, createContext: createContextPerOutputGroup });
}

/**
 * Recognises the options object of {@link setupEsbuild}, so anything else — a leftover bare watch
 * flag from the previous signature above all — fails loudly instead of being read as "no options
 * given", which would build once where the caller asked to watch, or split where it asked not to.
 */
function isSetupEsbuildOptions(options: unknown): options is SetupEsbuildOptions {
  if (typeof options !== "object" || options === null) {
    return false;
  }
  const settings = options as Record<string, unknown>;
  return Object.entries(SETUP_ESBUILD_SETTING_VALIDATORS).every(([setting, isValid]) => isValid(settings[setting]));
}

/**
 * Rejects a key {@link SetupEsbuildOptions} does not declare, so a misspelled setting — `sourceMap`
 * for `sourceMaps` — fails loudly instead of being ignored and leaving the setting at its default.
 */
function assertNoUnknownSetupEsbuildOptions(options: SetupEsbuildOptions): void {
  const unknownSettings = Object.keys(options).filter((setting) => !Object.hasOwn(SETUP_ESBUILD_SETTING_VALIDATORS, setting));
  if (unknownSettings.length === 0) {
    return;
  }
  throw new Error(
    `setupEsbuild's options object holds unknown setting(s) ${unknownSettings.map((setting) => `"${setting}"`).join(", ")}; ` +
    `the known settings are ${Object.keys(SETUP_ESBUILD_SETTING_VALIDATORS).join(", ")}`
  );
}

/** The setting's value where neither the options nor its own flag name one: the preset's under production. */
function defaultSourceMapsSetting(production: boolean): SourceMapsSetting {
  return production ? PRODUCTION_PRESET.sourceMaps : DEFAULT_SOURCE_MAPS_SETTING;
}

function isBooleanOrAbsent(setting: unknown): boolean {
  return setting === undefined || typeof setting === "boolean";
}

function isSourceMapsSettingOrAbsent(setting: unknown): boolean {
  return setting === undefined || isSourceMapsSetting(setting);
}

function isStringOrAbsent(setting: unknown): boolean {
  return setting === undefined || typeof setting === "string";
}
