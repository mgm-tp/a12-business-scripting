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

import type { BuildResult, WatchOptions } from "esbuild";

/**
 * The part of an esbuild `BuildContext` the build and watch lifecycle drives.
 *
 * A real `BuildContext` satisfies it, and so does the composite {@link combineBuildContexts} builds
 * over one context per output group — which is why `rebuild` may resolve to several results.
 */
export interface CombinedBuildContext {
  rebuild(): Promise<BuildResult | BuildResult[]>;
  watch(options?: WatchOptions): Promise<void>;
  dispose(): Promise<void>;
}

/** An esbuild context together with the output group it builds, so a failure can name its origin. */
export interface GroupedBuildContext {
  /** The group's path below the build directory; empty when a single source directory writes to the build root. */
  outputSubdirectory: string;
  buildContext: CombinedBuildContext;
}

/**
 * Combines one esbuild context per output group into a single context that applies every operation
 * to all of them.
 *
 * Each operation runs on every group even if another one fails — a half-disposed set of contexts
 * would leave esbuild child processes running — and a failure then rejects with a message naming the
 * failed operation and every group that failed, keeping the original error as `cause`.
 *
 * Usage: `combineBuildContexts([{ outputSubdirectory: "example-scripts", buildContext }])`
 */
export function combineBuildContexts(groupedBuildContexts: GroupedBuildContext[]): CombinedBuildContext {
  async function runOnEveryGroup<Result>(
    operationName: string,
    runOperation: (buildContext: CombinedBuildContext) => Promise<Result>
  ): Promise<Result[]> {
    const outcomes = await Promise.allSettled(
      groupedBuildContexts.map((groupedBuildContext) => runOperation(groupedBuildContext.buildContext))
    );
    throwIfAnyGroupFailed(operationName, groupedBuildContexts, outcomes);
    return outcomes.filter(isFulfilled).map((outcome) => outcome.value);
  }

  return {
    rebuild: () => runOnEveryGroup("rebuild", (buildContext) => buildContext.rebuild()).then(flattenBuildResults),
    watch: async (options?: WatchOptions) => {
      await runOnEveryGroup("watch", (buildContext) => buildContext.watch(options));
    },
    dispose: async () => {
      await runOnEveryGroup("dispose", (buildContext) => buildContext.dispose());
    },
  };
}

/** Flattens the per-group rebuild results, each of which is itself a result or a list of results. */
function flattenBuildResults(resultsPerGroup: (BuildResult | BuildResult[])[]): BuildResult[] {
  return resultsPerGroup.flat();
}

function isFulfilled<Result>(outcome: PromiseSettledResult<Result>): outcome is PromiseFulfilledResult<Result> {
  return outcome.status === "fulfilled";
}

function throwIfAnyGroupFailed(
  operationName: string,
  groupedBuildContexts: GroupedBuildContext[],
  outcomes: PromiseSettledResult<unknown>[]
): void {
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.status === "rejected"
      ? [{ outputSubdirectory: groupedBuildContexts[index]!.outputSubdirectory, error: outcome.reason as unknown }]
      : []
  );
  if (failures.length === 0) {
    return;
  }
  const describedFailures = failures
    .map((failure) => `  ${describeOutputGroup(failure.outputSubdirectory)}: ${String(failure.error)}`)
    .join("\n");
  const message =
    `esbuild failed to ${operationName} ${failures.length} of ${groupedBuildContexts.length} ` +
    `output group(s):\n${describedFailures}`;
  if (failures.length === 1) {
    throw new Error(message, { cause: failures[0]!.error });
  }
  throw new AggregateError(failures.map((failure) => failure.error), message);
}

function describeOutputGroup(outputSubdirectory: string): string {
  return outputSubdirectory === "" ? "the build root" : `output group "${outputSubdirectory}"`;
}

/** Normalises what a rebuild resolves to: one result for a single context, one per output group. */
export function toBuildResultList(rebuildOutcome: BuildResult | BuildResult[]): BuildResult[] {
  return Array.isArray(rebuildOutcome) ? rebuildOutcome : [rebuildOutcome];
}
