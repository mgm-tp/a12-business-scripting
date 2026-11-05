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

import type {FSWatcher} from "fs";

import type {BuildResult} from "esbuild";

import {assertBuildDirInsideCwd, cleanBuildDir} from "./buildDirectory.js";
import {type CombinedBuildContext, toBuildResultList} from "./combinedBuildContext.js";
import {discoverEntryPoints, type EntryPoint} from "./entryPoints.js";
import {warnAboutUnusedSourceFiles} from "./unusedSources.js";
import {watchWithDebounce} from "./watch.js";

const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_ESBUILD_WATCH_DELAY_MS = 500;

/** Everything `watchEsbuild` needs apart from the source directories to watch. */
interface WatchEsbuildOptions {
  ctx: CombinedBuildContext;
  entryPoints: EntryPoint[];
  buildDir: string;
  createContext: (entryPoints: EntryPoint[]) => Promise<CombinedBuildContext>;
  debounceMs?: number;
  esbuildWatchDelay?: number;
}

/**
 * Manages the full esbuild watch lifecycle so consumers do not copy it per project.
 *
 * Takes ownership of the already-built `ctx` and `entrypoints`. Starts `ctx.watch()` and
 * sets up one file watcher per source directory to detect new or removed `.ts` entrypoints. When
 * entrypoints change, disposes the old context, deletes `buildDir`, and recreates via
 * `createContext`. Recreations are serialised, so one logical change reported by several watchers
 * recreates the context once. When discovering the entry points or creating the context fails, closes
 * every watcher, logs the error and exits the process with code 1 — this function is intended for CLI
 * build scripts, not long-running embedded processes. A failed build of the recreated context is only
 * reported: a script that does not compile or type-check is fixed by a later edit, which only a live
 * session picks up.
 *
 * Returns a `Promise<FSWatcher[]>` — one watcher per source directory — that resolves after all
 * watchers are started. The caller is responsible for closing them when the watch session ends.
 * They otherwise run for the lifetime of the process.
 *
 * @param options.buildDir Must resolve strictly inside `process.cwd()` — it is deleted on entrypoint change.
 * @param options.debounceMs File-watcher debounce window in ms (default 200).
 * @param options.esbuildWatchDelay esbuild `ctx.watch({ delay })` rebuild debounce in ms (default 500).
 */
export async function watchEsbuild(options: WatchEsbuildOptions & { sourceDir: string }): Promise<FSWatcher[]>;
export async function watchEsbuild(options: WatchEsbuildOptions & { sourceDirs: string[] }): Promise<FSWatcher[]>;
export async function watchEsbuild(
  options: WatchEsbuildOptions & { sourceDir?: string; sourceDirs?: string[] }
): Promise<FSWatcher[]> {
  const {
    ctx,
    entryPoints: initialEntryPoints,
    sourceDir,
    sourceDirs,
    buildDir,
    createContext,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    esbuildWatchDelay = DEFAULT_ESBUILD_WATCH_DELAY_MS,
  } = options;

  const configuredSourceDirs = toSourceDirectoryList(sourceDir, sourceDirs);

  assertBuildDirInsideCwd(buildDir);

  let currentCtx = ctx;
  let currentEntryPoints = initialEntryPoints;
  // Watchers of different directories report the same logical change independently. Chaining the
  // recreations keeps a second report from disposing a context another one is still building.
  let pendingRecreation: Promise<void> = Promise.resolve();

  await currentCtx.watch({ delay: esbuildWatchDelay });

  async function recreateContextIfEntryPointsChanged(): Promise<void> {
    let updatedEntryPoints: EntryPoint[];
    try {
      // Inside the try because a source directory renamed mid-session makes the discovery itself
      // fail; letting that escape would leave the chained recreations permanently rejected.
      updatedEntryPoints = discoverEntryPoints(configuredSourceDirs);
      if (!entryPointsChanged(updatedEntryPoints, currentEntryPoints)) {
        return;
      }
      await currentCtx.dispose();
      cleanBuildDir(buildDir);
      currentCtx = await createContext(updatedEntryPoints);
    } catch (error) {
      closeWatchersAndExit(error);
      return;
    }
    // Recorded before the build: whether it succeeds or not, these are the entry points the context has.
    currentEntryPoints = updatedEntryPoints;
    const buildResults = await rebuildReportingFailure(currentCtx);
    if (buildResults !== undefined) {
      await warnAboutUnusedSourceFiles(configuredSourceDirs, buildResults);
    }
    await currentCtx.watch({ delay: esbuildWatchDelay });
  }

  function closeWatchersAndExit(error: unknown): void {
    fsWatchers.forEach((fsWatcher) => fsWatcher.close());
    console.error("Failed to recreate esbuild context after entrypoint change:", error);
    process.exit(1);
  }

  const fsWatchers = configuredSourceDirs.map((configuredSourceDir) =>
    watchWithDebounce(configuredSourceDir, () => {
      pendingRecreation = pendingRecreation.then(recreateContextIfEntryPointsChanged);
      return pendingRecreation;
    }, debounceMs)
  );

  return fsWatchers;
}

/** Accepts the single-directory and the multi-directory form, and rejects giving both or neither. */
function toSourceDirectoryList(sourceDir: string | undefined, sourceDirs: string[] | undefined): string[] {
  if (sourceDir !== undefined && sourceDirs !== undefined) {
    throw new Error("exactly one of sourceDir and sourceDirs must be given, not both");
  }
  if (sourceDirs !== undefined) {
    return sourceDirs;
  }
  if (sourceDir !== undefined) {
    return [sourceDir];
  }
  throw new Error("exactly one of sourceDir and sourceDirs must be given");
}

/**
 * Rebuilds for a watch session: a successful build yields its results; a failed one is stated in one
 * line and yields `undefined`, and the session goes on watching for the next edit. Nothing blocks
 * here, since esbuild has already printed the diagnostics themselves.
 */
export async function rebuildReportingFailure(ctx: CombinedBuildContext): Promise<BuildResult[] | undefined> {
  try {
    return toBuildResultList(await ctx.rebuild());
  } catch (error) {
    console.error(`${describeBuildFailure(error)}. Watching for the next edit...`);
    return undefined;
  }
}

/** The failure's first line without its trailing colon — the diagnostics below it are already printed. */
function describeBuildFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split("\n")[0] ?? message).replace(/:$/, "");
}

function entryPointsChanged(updated: EntryPoint[], current: EntryPoint[]): boolean {
  if (updated.length !== current.length) {
    return true;
  }
  const sortedUpdated = toSortedIdentifiers(updated);
  const sortedCurrent = toSortedIdentifiers(current);
  return sortedUpdated.some((value, index) => value !== sortedCurrent[index]);
}

function toSortedIdentifiers(entryPoints: EntryPoint[]): string[] {
  return entryPoints.map((entryPoint) => `${entryPoint.in} ${entryPoint.out}`).sort();
}