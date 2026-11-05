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

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";

import { toForwardSlashes } from "../forwardSlashes.js";

/**
 * Fixtures for the real-esbuild integration tests: temporary workspaces, script sources and readers for the built output.
 *
 * @packageDocumentation
 */

/**
 * Lies below the devtools build directory rather than in the system temp directory,
 * because `setupEsbuild` requires its build directory to lie inside the current working directory.
 */
const INTEGRATION_WORKSPACE_ROOT = "build/esbuildIntegration";
const BUILD_SUB_DIR = "build";

export const SCRIPT_FILE = "script.ts";
export const HELPER_FILE = "helper.ts";
export const FIRST_SOURCE_DIR_NAME = "first-scripts";
export const SECOND_SOURCE_DIR_NAME = "second-scripts";

export const HELPER_SOURCE = `export function shout(text: string): string {
  return text.toUpperCase();
}
`;

export function scriptImportingFromHelper(helperPath: string): string {
  return `import { shout } from "${helperPath}";
function execute(): string {
  return shout("hi");
}
`;
}

export interface IntegrationWorkspace {
  /** The configured source directories, relative to the current working directory. */
  sourceDirs: string[];
  /** The build directory, relative to the current working directory. */
  buildDir: string;
}

const createdWorkspaceRoots: string[] = [];

/** Creates one workspace whose source directories hold the given files, keyed by relative path. */
export function createWorkspace(sourceFilesBySourceDirName: Record<string, Record<string, string>>): IntegrationWorkspace {
  // Create the workspace root folder workspace-<id>
  mkdirSync(INTEGRATION_WORKSPACE_ROOT, { recursive: true });
  const workspaceRoot = mkdtempSync(join(INTEGRATION_WORKSPACE_ROOT, "workspace-"));
  createdWorkspaceRoots.push(workspaceRoot);
  // Create <directory>/src for each directory inside the root folder and add the source files.
  const sourceDirs = Object.entries(sourceFilesBySourceDirName).map(([sourceDirName, sourceFiles]) => {
    const sourceDir = join(workspaceRoot, sourceDirName, "src");
    for (const [filePath, tsSource] of Object.entries(sourceFiles)) {
      const sourceFile = join(sourceDir, filePath);
      mkdirSync(dirname(sourceFile), { recursive: true });
      writeFileSync(sourceFile, tsSource);
    }
    return relative(process.cwd(), sourceDir);
  });
  return { sourceDirs, buildDir: relative(process.cwd(), join(workspaceRoot, BUILD_SUB_DIR)) };
}

/** Deletes every workspace {@link createWorkspace} created since the last call. */
export function removeCreatedWorkspaces(): void {
  createdWorkspaceRoots.splice(0).forEach((workspaceRoot) => rmSync(workspaceRoot, { recursive: true, force: true }));
}

export function listBuiltFiles(buildDir: string): string[] {
  return readdirSync(buildDir, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith(".js"))
    .map(toForwardSlashes)
    .sort();
}

export function readBuiltFile(buildDir: string, ...pathSegments: string[]): string {
  return readFileSync(join(buildDir, ...pathSegments), "utf-8");
}
