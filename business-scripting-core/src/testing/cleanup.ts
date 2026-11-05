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

// Links are not explicitly cleaned up — DS cascade-deletes them when the owning document is removed.

import {executionContext, isTestContext} from "../api/execution-contexts.js";
import {A12} from "../api/facades/index.js";
import {PAGE_SIZE_LIMIT} from "../internal/constants.js";

function documentModels(): string[] {
    return (process.env['A12_SCRIPTING_TESTING_DOCUMENT_MODELS'] ?? '')
        .split(',').map(s => s.trim()).filter(Boolean);
}

async function removeDocumentsCreatedAfter(date: Date, modelNames: string[]): Promise<void> {
    if (!isTestContext(executionContext)) {
        throw new Error('Script test cleanup for documents is only usable in a test context');
    }
    for (const modelName of modelNames) {
        await removeDocumentsOfModelCreatedAfter(modelName, date)
    }
}

async function removeDocumentsOfModelCreatedAfter(modelName: string, date: Date): Promise<void> {
    let previousDocRefStrings: string[] = []
    let docRefStrings: string[] = []
    do {
        const docRefs = (await A12.Documents.find(
            modelName,
            {
                operator: "date_range",
                field: "/__meta/createdAt",
                from: toA12DateTime(date)
            }
        )).toArray()
        docRefStrings = docRefs.map(docRef => docRef.toString())
        if (docRefStrings.length === PAGE_SIZE_LIMIT && containsSameDocuments(docRefStrings, previousDocRefStrings)) {
            throw new Error(
                `Script test cleanup of document model '${modelName}' made no progress: the same ${PAGE_SIZE_LIMIT} `
                + `documents were returned again after deleting them. Aborting instead of querying forever.`
            )
        }
        await Promise.all(docRefs.map(docRef => A12.Documents.remove(docRef)))
        previousDocRefStrings = docRefStrings
    } while (docRefStrings.length === PAGE_SIZE_LIMIT)
}

function containsSameDocuments(docRefStrings: string[], otherDocRefStrings: string[]): boolean {
    if (docRefStrings.length !== otherDocRefStrings.length) { return false }
    const otherDocRefStringSet = new Set(otherDocRefStrings)
    return docRefStrings.every(docRefString => otherDocRefStringSet.has(docRefString))
}

export interface CleanupRegistry {
    beforeEach: () => void;
    afterEach: () => Promise<void>;
}

export const cleanup: CleanupRegistry = (() => {
    let eachTimestamp: Date | undefined;
    return {
        beforeEach: () => { eachTimestamp = new Date(); },
        afterEach: async () => {
            if (!eachTimestamp) { return; }
            // Links cascade-delete automatically when their owning document is deleted.
            await removeDocumentsCreatedAfter(eachTimestamp, documentModels());
        }
    };
})();

function toA12DateTime(date: Date): string {
    return date.toISOString().replace("Z", "").split(".")[0]!
}
