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

export const signatureRegex =
  /(?:async\s+)?function\s+execute\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/s;

export const exportBlockRegex = /export\s*\{[^}]*\}\s*;/;

/**
 * Whether a TypeScript source declares the `execute` entry function, which is what makes it a script
 * rather than a helper module the scripts import.
 *
 * Single home for that decision: entry-point discovery, the entry-function protection plugin and the
 * outside-source-directory warning all ask this instead of applying {@link signatureRegex} themselves.
 * Only the script metadata injector keeps matching directly, because it reads the signature's capture
 * groups and would otherwise scan the same source twice for one answer.
 */
export function declaresEntryFunction(tsSource: string): boolean {
  return signatureRegex.test(tsSource);
}