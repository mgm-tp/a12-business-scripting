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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENGINE_SYNTAX_TARGET } from "../engineEcmaScriptLevel.js";
import { findLibrariesTheEngineLacks, warnAboutLibraryLevel } from "../typeCheckerLibraries.js";

vi.mock("child_process", () => ({ exec: vi.fn() }));

const LIBRARY_ABOVE_ENGINE_LEVEL = "esnext";
const SUB_LIBRARY_ABOVE_ENGINE_LEVEL = "esnext.temporal";
const LIBRARY_BELOW_ENGINE_LEVEL = "es2020";
const HOST_LIBRARY = "dom";
const HOST_SUB_LIBRARY = "dom.iterable";
const NON_ECMASCRIPT_LIBRARY = "decorators";
/** What TypeScript type-checks against when `tsconfig.json` sets no `lib`: the target's level plus the DOM. */
const IMPLICIT_HOST_LIBRARY = "dom (TypeScript's default without lib)";
const SHOW_CONFIG_FAILURE_OUTPUT = "error TS5057: Cannot find a tsconfig.json file";

describe("findLibrariesTheEngineLacks", () => {
  it("should name a lib level above what the engine implements", () => {
    expect(findLibrariesTheEngineLacks({ lib: [LIBRARY_ABOVE_ENGINE_LEVEL] }))
      .toEqual([LIBRARY_ABOVE_ENGINE_LEVEL]);
  });

  it("should name a sub-library above the engine level, which alone admits its built-ins", () => {
    expect(findLibrariesTheEngineLacks({ lib: [ENGINE_SYNTAX_TARGET, SUB_LIBRARY_ABOVE_ENGINE_LEVEL] }))
      .toEqual([SUB_LIBRARY_ABOVE_ENGINE_LEVEL]);
  });

  it("should stay silent about the engine's own level", () => {
    expect(findLibrariesTheEngineLacks({ lib: [ENGINE_SYNTAX_TARGET] })).toEqual([]);
  });

  it("should stay silent about a level below the engine's, which rejects built-ins the engine has", () => {
    // given — too strict is the consumer's choice to make and never a runtime failure
    expect(findLibrariesTheEngineLacks({ lib: [LIBRARY_BELOW_ENGINE_LEVEL] })).toEqual([]);
  });

  it("should ignore a library that names neither an ECMAScript level nor a host", () => {
    expect(findLibrariesTheEngineLacks({ lib: [NON_ECMASCRIPT_LIBRARY, ENGINE_SYNTAX_TARGET] })).toEqual([]);
  });

  it.each([HOST_LIBRARY, HOST_SUB_LIBRARY, "webworker", "scripthost"])(
    "should name the host library %s, whose built-ins such as setTimeout or fetch the engine lacks",
    (hostLibrary) => {
      expect(findLibrariesTheEngineLacks({ lib: [ENGINE_SYNTAX_TARGET, hostLibrary] })).toEqual([hostLibrary]);
    }
  );

  it("should read the target where no lib is set, since that is what lib defaults to", () => {
    expect(findLibrariesTheEngineLacks({ target: LIBRARY_ABOVE_ENGINE_LEVEL }))
      .toEqual([LIBRARY_ABOVE_ENGINE_LEVEL, IMPLICIT_HOST_LIBRARY]);
  });

  it("should name the DOM TypeScript adds where no lib is set, even at the engine's own target", () => {
    expect(findLibrariesTheEngineLacks({ target: ENGINE_SYNTAX_TARGET })).toEqual([IMPLICIT_HOST_LIBRARY]);
  });

  it("should ignore the target where lib is set, since lib then decides alone", () => {
    expect(findLibrariesTheEngineLacks({ lib: [ENGINE_SYNTAX_TARGET], target: LIBRARY_ABOVE_ENGINE_LEVEL }))
      .toEqual([]);
  });

  it("should name the DOM TypeScript adds without lib and target", () => {
    expect(findLibrariesTheEngineLacks({})).toEqual([IMPLICIT_HOST_LIBRARY]);
  });

  it("should match a level TypeScript accepts in mixed case", () => {
    expect(findLibrariesTheEngineLacks({ lib: ["ESNext"] })).toEqual(["ESNext"]);
  });
});

describe("warnAboutLibraryLevel", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  /** Makes `tsc --showConfig` answer as given instead of running it. */
  function mockShowConfig(result: { error?: Error; stdout?: string; stderr?: string }): void {
    type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;
    vi.mocked(exec).mockImplementation(((_command: string, _options: unknown, callback: ExecCallback) => {
      callback(result.error ?? null, result.stdout ?? "", result.stderr ?? "");
    }) as unknown as typeof exec);
  }

  function onlyWarning(): string {
    return String(warnSpy.mock.calls[0]![0]);
  }

  function showConfigWithLibraries(libraries: string[]): string {
    return JSON.stringify({ compilerOptions: { lib: libraries } });
  }

  it("should warn naming a library level of the resolved tsconfig above the engine level", async () => {
    // given
    mockShowConfig({ stdout: showConfigWithLibraries([LIBRARY_ABOVE_ENGINE_LEVEL]) });

    // when
    await warnAboutLibraryLevel();

    // then
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(onlyWarning()).toContain(`"${LIBRARY_ABOVE_ENGINE_LEVEL}"`);
  });

  it("should stay silent when the resolved tsconfig stays at the engine level", async () => {
    // given
    mockShowConfig({ stdout: showConfigWithLibraries([ENGINE_SYNTAX_TARGET]) });

    // when
    await warnAboutLibraryLevel();

    // then
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should warn with TypeScript's reason when the tsconfig cannot be resolved", async () => {
    // given — an unknown level must not pass as compliant
    mockShowConfig({ error: new Error("Command failed"), stderr: SHOW_CONFIG_FAILURE_OUTPUT });

    // when
    await warnAboutLibraryLevel();

    // then
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(onlyWarning()).toContain("could not read the type check's library level");
    expect(onlyWarning()).toContain(SHOW_CONFIG_FAILURE_OUTPUT);
  });

  it("should warn when the resolved tsconfig is not valid JSON", async () => {
    // given — should fail to parse because the output is cut off mid-object
    mockShowConfig({ stdout: '{ "compilerOptions": ' });

    // when
    await warnAboutLibraryLevel();

    // then
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(onlyWarning()).toContain("not valid JSON");
  });
});
