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

package com.mgmtp.a12.scripting.gradle.plugins.conventions.legal

import java.io.File

/**
 * Detects placeholder content in an already-[LegalDocuments]-resolved set: the marker text in
 * `LICENSE`, `NOTICE` and `THIRD_PARTY_NOTICES`, and a `licenses/` directory holding no
 * non-dotfile (at least one dependency provides a licence, so an empty directory means
 * generation went wrong). Never touches a [org.gradle.api.Project], so it is always safe to
 * call from a task action.
 */
object LegalDocumentPlaceholderDetector {

    const val PLACEHOLDER_MARKER: String = "PLACEHOLDER: not yet generated"

    /**
     * One human-readable description per document that still carries the marker, plus one for a
     * `licenses/` directory holding no non-dotfile. Empty list means nothing is a placeholder.
     */
    fun describePlaceholders(documents: LegalDocuments): List<String> = listOfNotNull(
        placeholderDescriptionOrNull(documents.license),
        placeholderDescriptionOrNull(documents.notice),
        placeholderDescriptionOrNull(documents.thirdPartyNotices),
        emptyLicensesDirectoryDescriptionOrNull(documents.licensesDirectory),
    )

    private fun placeholderDescriptionOrNull(document: File): String? =
        if (document.readText().contains(PLACEHOLDER_MARKER)) "${document.name} (${document.path}) is still a placeholder" else null

    private fun emptyLicensesDirectoryDescriptionOrNull(licensesDirectory: File): String? {
        val holdsNonDotfile = licensesDirectory.listFiles().orEmpty().any { !it.name.startsWith(".") }
        return if (holdsNonDotfile) null else "${licensesDirectory.name} (${licensesDirectory.path}) holds no non-dotfile third-party licence text"
    }
}
