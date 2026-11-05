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

/**
 * ESLint flat config for A12 Business Scripting authors.
 * Scoped to projects using `@com.mgmtp.a12.scripting/business-scripting-core` as their scripting API.
 */
import type {Linter} from "eslint"

import * as devtoolsConfigs from "@com.mgmtp.a12.devtools/eslint-config"

export interface ImportRestrictionPattern {
  regex: string
  message: string
}

const BUSINESS_SCRIPTING_CORE = String.raw`@com\.mgmtp\.a12\.scripting/business-scripting-core$`
const BUSINESS_SCRIPTING_CORE_TESTING = "@com.mgmtp.a12.scripting/business-scripting-core/testing"

function escapeRegExp(str: string): string {
  // map each special character to it's escaped version
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildImportRestrictionPattern(allowedImports?: string | string[]): ImportRestrictionPattern {
  if (!allowedImports || typeof allowedImports === "string" ) { allowedImports =  [] }
  const allowlist = [BUSINESS_SCRIPTING_CORE, ...allowedImports.map(escapeRegExp), String.raw`\.{1,2}/`]
  const extraAllowedNote = allowedImports.length > 0 ? `, ${allowedImports.join(", ")},` : ""
  return {
    regex: String.raw`^(?!${allowlist.join("|")})`,
    message: `Scripts may only import from @com.mgmtp.a12.scripting/business-scripting-core${extraAllowedNote} or relative paths.`,
  }
}

export function scriptAuthoringConfigs(allowedImports: string[] = []): Linter.Config[] {
  const allowedTestImports = [...allowedImports, "chai", "vitest", BUSINESS_SCRIPTING_CORE_TESTING]
  return [
    ...devtoolsConfigs.recommended,
    {
      ignores: ["**/*.d.ts", "**/dist", "**/node_modules","**/build"],
    },
    {
      files: ["**/*.ts"],
      ignores: ["vitest.config.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        // exclude execute function from linting as it will always be unused
        "@typescript-eslint/no-unused-vars": ["error", { "varsIgnorePattern": "^execute$" }],
        semi: ["error", "never"],
        "no-restricted-imports": ["error", { patterns: [buildImportRestrictionPattern(allowedImports)] }],
      },
    },
    {
      // allow unused expressions in test scripts to avoid false positives for chai assertion properties
      files: ["**/*.test.ts"],
      rules: {
        "@typescript-eslint/no-unused-expressions": "off",
        "no-restricted-imports": ["error", { patterns: [buildImportRestrictionPattern(allowedTestImports)]}]
      },
    },
  ]
}

export default scriptAuthoringConfigs
