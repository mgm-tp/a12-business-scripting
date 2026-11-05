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

import org.gradle.api.GradleException
import org.gradle.api.Project
import java.io.File

/**
 * Resolves the four legal documents for a module, either always from the repository root (the
 * npm half) or preferring a module-local copy per document (the JVM half). Both entry points
 * fail with every missing document named, alongside every path that was searched.
 */
object LegalDocumentResolver {

    const val MISSING_DOCUMENTS_FAILURE_MESSAGE = "Missing legal document(s):"

    /** Root documents only. Throws [GradleException] naming every missing document. */
    fun resolveFromRootOrFail(project: Project): LegalDocuments = resolveOrFail(rootDirectory = project.rootDir)

    /** Module-local document wins per document, root is the fallback. Throws as above. */
    fun resolvePreferringModuleLocalOrFail(project: Project): LegalDocuments =
        resolveOrFail(rootDirectory = project.rootDir, moduleDirectory = project.projectDir)

    private fun resolveOrFail(rootDirectory: File, moduleDirectory: File? = null): LegalDocuments {
        val license = moduleLocalOrRoot(rootDirectory, moduleDirectory, LegalDocumentFileNames.LICENSE) { it.isFile }
        val notice = moduleLocalOrRoot(rootDirectory, moduleDirectory, LegalDocumentFileNames.NOTICE) { it.isFile }
        val thirdPartyNotices = moduleLocalOrRoot(rootDirectory, moduleDirectory, LegalDocumentFileNames.THIRD_PARTY_NOTICES) { it.isFile }
        val licensesDirectory = moduleLocalOrRoot(rootDirectory, moduleDirectory, LegalDocumentFileNames.LICENSES_DIRECTORY) { it.isDirectory }

        val missingDocumentDescriptions = listOfNotNull(
            missingDocumentDescriptionOrNull(LegalDocumentFileNames.LICENSE, license) { it.isFile },
            missingDocumentDescriptionOrNull(LegalDocumentFileNames.NOTICE, notice) { it.isFile },
            missingDocumentDescriptionOrNull(LegalDocumentFileNames.THIRD_PARTY_NOTICES, thirdPartyNotices) { it.isFile },
            missingDocumentDescriptionOrNull(LegalDocumentFileNames.LICENSES_DIRECTORY, licensesDirectory) { it.isDirectory },
        )
        if (missingDocumentDescriptions.isNotEmpty()) {
            throw GradleException(
                MISSING_DOCUMENTS_FAILURE_MESSAGE +
                    System.lineSeparator() +
                    missingDocumentDescriptions.joinToString(System.lineSeparator()),
            )
        }

        return LegalDocuments(license, notice, thirdPartyNotices, licensesDirectory)
    }

    /**
     * Chooses the module-local path when [moduleDirectory] is given and the module-local path
     * exists (per [existsAs]); otherwise falls back to the root path. Resolution is per document,
     * not all-or-nothing.
     */
    private fun moduleLocalOrRoot(rootDirectory: File, moduleDirectory: File?, name: String, existsAs: (File) -> Boolean): File {
        val moduleLocalPath = moduleDirectory?.resolve(name)
        return if (moduleLocalPath != null && existsAs(moduleLocalPath)) moduleLocalPath else rootDirectory.resolve(name)
    }

    private fun missingDocumentDescriptionOrNull(name: String, path: File, existsAs: (File) -> Boolean): String? =
        if (existsAs(path)) null else "$name (searched at ${path.path})"
}
