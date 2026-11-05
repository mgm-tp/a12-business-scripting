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

import {describe, expect, it} from "vitest"
import type {Linter} from "eslint"

import {type ImportRestrictionPattern, scriptAuthoringConfigs} from "../index.js"

function findTypescriptFilesConfig(configs: Linter.Config[]): Linter.Config {
  const config = configs.find(
    c => c.files?.includes("**/*.ts") && c.rules?.["no-restricted-imports"] !== undefined
  )
  if (!config) {throw new Error("No TS files config found")}
  return config
}

function findTestFilesConfig(configs: Linter.Config[]): Linter.Config {
  const config = configs.find(c => c.files?.includes("**/*.test.ts"))
  if (!config) {throw new Error("No test files config found")}
  return config
}

function extractImportRestrictionPattern(config: Linter.Config): ImportRestrictionPattern {
  const rule = config.rules?.["no-restricted-imports"] as [string, { patterns: ImportRestrictionPattern[] }]
  return rule[1]!.patterns[0]!
}

function isRestricted(pattern: ImportRestrictionPattern, importPath: string): boolean {
  return new RegExp(pattern.regex).test(importPath)
}

describe("scriptAuthoringConfigs", () => {
  describe("import restrictions with no extra allowed imports", () => {
    const configs = scriptAuthoringConfigs()
    const tsConfig = findTypescriptFilesConfig(configs)
    const pattern = extractImportRestrictionPattern(tsConfig)

    it("should allow imports from business-scripting-core", () => {
      expect(isRestricted(pattern, "@com.mgmtp.a12.scripting/business-scripting-core")).toBe(false)
    })

    it("should allow relative imports", () => {
      expect(isRestricted(pattern, "./some-module")).toBe(false)
      expect(isRestricted(pattern, "../parent-module")).toBe(false)
    })

    it("should restrict imports from other packages", () => {
      expect(isRestricted(pattern, "lodash")).toBe(true)
      expect(isRestricted(pattern, "@company/some-lib")).toBe(true)
    })

    it("should include business-scripting-core and relative paths in restriction message", () => {
      expect(pattern.message).toContain("@com.mgmtp.a12.scripting/business-scripting-core")
      expect(pattern.message).toContain("relative paths")
    })

    it("should not mention extra packages in message when none are provided", () => {
      expect(pattern.message).not.toContain("lodash")
    })

    it("should restrict chai and vitest in non-test TypeScript files", () => {
      expect(isRestricted(pattern, "chai")).toBe(true)
      expect(isRestricted(pattern, "vitest")).toBe(true)
    })

    it("should restrict business-scripting-core/testing in non-test TypeScript files", () => {
      expect(isRestricted(pattern, "@com.mgmtp.a12.scripting/business-scripting-core/testing")).toBe(true)
    })
  })

  describe("import restrictions with extra allowed imports", () => {
    const allowedImports = ["lodash", "@company/some-lib"]
    const configs = scriptAuthoringConfigs(allowedImports)
    const tsConfig = findTypescriptFilesConfig(configs)
    const pattern = extractImportRestrictionPattern(tsConfig)

    it("should allow additionally specified imports", () => {
      expect(isRestricted(pattern, "lodash")).toBe(false)
      expect(isRestricted(pattern, "@company/some-lib")).toBe(false)
    })

    it("should still restrict other packages", () => {
      expect(isRestricted(pattern, "chalk")).toBe(true)
    })

    it("should include extra imports in restriction message", () => {
      expect(pattern.message).toContain("lodash")
      expect(pattern.message).toContain("@company/some-lib")
    })
  })

  describe("import restrictions with special regex characters in allowed import names", () => {
    const configs = scriptAuthoringConfigs(["@com.mgmtp.a12/some.package"])
    const tsConfig = findTypescriptFilesConfig(configs)
    const pattern = extractImportRestrictionPattern(tsConfig)

    it("should allow the exact package name with dots", () => {
      expect(isRestricted(pattern, "@com.mgmtp.a12/some.package")).toBe(false)
    })

    it("should not allow a package where dots are substituted by other characters", () => {
      expect(isRestricted(pattern, "@comXmgmtpXa12/someXpackage")).toBe(true)
    })
  })

  describe("test file overrides", () => {
    const configs = scriptAuthoringConfigs()
    const testConfig = findTestFilesConfig(configs)
    const testPattern = extractImportRestrictionPattern(testConfig)

    it("should disable no-unused-expressions in test files", () => {
      expect(testConfig.rules?.["@typescript-eslint/no-unused-expressions"]).toBe("off")
    })

    it("should allow imports from chai in test files", () => {
      expect(isRestricted(testPattern, "chai")).toBe(false)
    })

    it("should allow imports from vitest in test files", () => {
      expect(isRestricted(testPattern, "vitest")).toBe(false)
      expect(isRestricted(testPattern, "vitest/config")).toBe(false)
    })

    it("should allow imports from business-scripting-core in test files", () => {
      expect(isRestricted(testPattern, "@com.mgmtp.a12.scripting/business-scripting-core")).toBe(false)
    })

    it("should allow imports from business-scripting-core/testing in test files", () => {
      expect(isRestricted(testPattern, "@com.mgmtp.a12.scripting/business-scripting-core/testing")).toBe(false)
    })

    it("should allow relative imports in test files", () => {
      expect(isRestricted(testPattern, "./some-module")).toBe(false)
      expect(isRestricted(testPattern, "../parent-module")).toBe(false)
    })

    it("should still restrict other packages in test files", () => {
      expect(isRestricted(testPattern, "lodash")).toBe(true)
      expect(isRestricted(testPattern, "@company/some-lib")).toBe(true)
    })
  })

  describe("TypeScript file rules", () => {
    const configs = scriptAuthoringConfigs()
    const tsConfig = findTypescriptFilesConfig(configs)

    it("should error on explicit any", () => {
      expect(tsConfig.rules?.["@typescript-eslint/no-explicit-any"]).toBe("error")
    })

    it("should error on semicolons", () => {
      expect(tsConfig.rules?.["semi"]).toEqual(["error", "never"])
    })

    it("should error on unused variables except the execute function", () => {
      expect(tsConfig.rules?.["@typescript-eslint/no-unused-vars"]).toEqual(["error", { varsIgnorePattern: "^execute$" }])
    })

    it("should ignore vitest.config.ts", () => {
      expect(tsConfig.ignores).toContain("vitest.config.ts")
    })
  })
})
