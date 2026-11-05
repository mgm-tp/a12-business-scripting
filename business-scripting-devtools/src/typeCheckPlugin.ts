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

import { spawn, type ChildProcess } from "child_process";

import type { OnStartResult, Plugin } from "esbuild";

/**
 * Returns a plugin that runs `typeCheckCommand` before every build and fails the build with the
 * command's own output when it exits non-zero.
 *
 * A failed build writes no output, and esbuild removes what a previous build of the same context
 * wrote — so a script that does not type-check is never left behind for the runtime to register,
 * neither newly built nor as the copy built before the error. The command is the consumer's, which
 * keeps the choice of type checker and of `tsconfig.json` with the consumer.
 *
 * Every build runs its own check, also when several output groups build concurrently: a build
 * that joined a check started before its own edit was saved could emit a script that does not
 * type-check.
 */
export function createTypeCheckPlugin(typeCheckCommand: string): Plugin {
  return {
    name: "type-check",
    setup(build) {
      build.onStart(() => runTypeCheck(typeCheckCommand));
    },
  };
}

function runTypeCheck(typeCheckCommand: string): Promise<OnStartResult> {
  return new Promise((resolve) => {
    let typeCheck: ChildProcess;
    try {
      typeCheck = spawn(typeCheckCommand, { shell: true });
    } catch (error) {
      // A command the operating system rejects outright must fail the build, not the build script.
      resolve(toBuildErrors(describeUnrunnableTypeCheck(typeCheckCommand, String(error))));
      return;
    }

    let output = "";
    const collectOutput = (chunk: unknown) => { output += String(chunk); };
    typeCheck.stdout?.on("data", collectOutput);
    typeCheck.stderr?.on("data", collectOutput);

    typeCheck.on("error", (error) => {
      resolve(toBuildErrors(describeUnrunnableTypeCheck(typeCheckCommand, error.message)));
    });
    typeCheck.on("close", (status, signal) => {
      resolve(toTypeCheckOutcome(typeCheckCommand, status, signal, output.trim()));
    });
  });
}

function toTypeCheckOutcome(
  typeCheckCommand: string,
  status: number | null,
  signal: NodeJS.Signals | null,
  diagnostics: string
): OnStartResult {
  if (status === 0) {
    return {};
  }
  return toBuildErrors(
    `type check "${typeCheckCommand}" failed${describeExitStatus(status, signal)}` +
    (diagnostics === "" ? " without any output" : `:\n${diagnostics}`)
  );
}

/** A signal instead of an exit code is what a killed type check reports, and it fails the build too. */
function describeExitStatus(status: number | null, signal: NodeJS.Signals | null): string {
  return status === null ? ` (killed by ${signal ?? "an unknown signal"})` : ` (exit code ${status})`;
}

function describeUnrunnableTypeCheck(typeCheckCommand: string, reason: string): string {
  return `type check "${typeCheckCommand}" could not be run: ${reason}`;
}

function toBuildErrors(text: string): OnStartResult {
  return { errors: [{ text }] };
}
