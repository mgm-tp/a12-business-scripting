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

import { describe, expect, it } from "vitest";

import { declaresEntryFunction, exportBlockRegex, signatureRegex } from "../regex.js";

describe("signatureRegex", () => {
  describe("matches execute function variants", () => {
    it.each([
      { prefix: "", returnType: "Outputs" },
      { prefix: "async ", returnType: "Promise<Outputs>" },
      { prefix: "export ", returnType: "Outputs" },
      { prefix: "export async ", returnType: "Promise<Outputs>" },
      { prefix: "export default ", returnType: "Outputs" },
      { prefix: "export default async ", returnType: "Promise<Outputs>" },
    ])("should match $prefix execute function with params and return type", ({ prefix, returnType }) => {
      const source = `${prefix}function execute(inputs: Inputs): ${returnType} {`;
      const match = source.match(signatureRegex);
      expect(match).not.toBeNull();
      expect(match![1]).toBe("inputs: Inputs");
      expect(match![2]).toBe(returnType);
    });
  });

  describe("matches execute function without return type", () => {
    it.each([
      { label: "no params, no return type", source: "function execute() {", params: "" },
      { label: "with params, no return type", source: "function execute(inputs: Inputs) {", params: "inputs: Inputs" },
    ])("should match $label", ({ source, params }) => {
      const match = source.match(signatureRegex);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(params);
      expect(match![2]).toBeUndefined();
    });
  });

  describe("matches multi-line signatures", () => {
    it.each([
      { prefix: "", returnType: "Outputs" },
      { prefix: "async ", returnType: "Promise<Outputs>" },
    ])("should match $prefix execute function with params spanning multiple lines", ({ prefix, returnType }) => {
      const source = `${prefix}function execute(\n  inputs: Inputs\n): ${returnType} {`;
      const match = source.match(signatureRegex);
      expect(match).not.toBeNull();
      expect(match![2]).toBe(returnType);
    });
  });

  describe("does not match non-execute functions or non-function code", () => {
    it.each([
      ["arbitrary function name", "function myScript(inputs: Inputs): Outputs {"],
      ["arrow functions", "const execute = (inputs: Inputs): Outputs => {"],
      ["function calls", "execute(inputs);"],
      ["generator functions", "function* execute() {"],
      ["declare function (no body)", "declare function execute(inputs: Inputs): Outputs;"],
    ])("should not match %s", (_, source) => {
      expect(source.match(signatureRegex)).toBeNull();
    });
  });
});

describe("declaresEntryFunction", () => {
  it.each([
    ["a top-level entry function", "function execute(inputs: Inputs): Outputs {\n  return { result: 1 };\n}"],
    ["an async entry function", "async function execute(): Promise<void> {\n}"],
  ])("should classify a source with %s as a script", (_, tsSource) => {
    expect(declaresEntryFunction(tsSource)).toBe(true);
  });

  it("should classify a source without an entry function as a helper module", () => {
    expect(declaresEntryFunction("export function toUpperCase(text: string): string {\n  return text;\n}")).toBe(false);
  });

  it("should classify a source whose only entry function is nested as a script", () => {
    // Documents today's behaviour: the signature is matched anywhere, so a nested declaration passes.
    // A helper declaring one is a corner case nobody has hit; narrowing the regex is a separate change.
    expect(declaresEntryFunction("function outer(): void {\n  function execute(): void {}\n}")).toBe(true);
  });
});

describe("exportBlockRegex", () => {
  it.each([
    ["single-export block", "export { execute };"],
    ["multi-export block", "export { execute, helper };"],
  ])("should match %s", (_, source) => {
    expect(source.match(exportBlockRegex)).not.toBeNull();
  });

  it("should not match named export declarations", () => {
    expect("export function execute() {}".match(exportBlockRegex)).toBeNull();
  });
});
