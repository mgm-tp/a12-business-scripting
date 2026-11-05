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

package com.mgmtp.a12.scripting.gradle.plugins.license

import org.gradle.api.model.ObjectFactory
import java.io.File

/**
 * Resolves files to check or format according to a set of [LicenseHeaderRule]s.
 *
 * Each rule's folder is resolved relative to the [rootDir]. When two rules share a
 * file extension and one folder is a prefix of the other, the longer (more specific) folder
 * takes precedence for files within that subtree (longest-match precedence).
 *
 * Uses [ObjectFactory.fileTree] (rather than `Project.fileTree`) so file resolution stays
 * configuration-cache compatible: unlike `Project`, `ObjectFactory` may safely be retained
 * and used by a task at execution time.
 */
internal object LicenseFileResolver {

    data class ResolvedFile(val file: File, val commentStyle: CommentStyle)

    fun resolve(
        objects: ObjectFactory,
        rootDir: File,
        rules: List<LicenseHeaderRule>,
        excludes: Set<String>
    ): List<ResolvedFile> {
        // Sort by resolved folder path length descending so more specific folders are processed first.
        val orderedRules = rules
            .map { ResolvedRule(rootDir.resolve(it.folder).canonicalFile, it.fileExtension, it.commentStyle) }
            .sortedByDescending { it.absoluteFolder.absolutePath.length }

        val seen = mutableSetOf<File>()
        val results = mutableListOf<ResolvedFile>()

        for (rule in orderedRules) {
            if (!rule.absoluteFolder.exists()) continue
            val tree = objects.fileTree().from(rule.absoluteFolder)
            tree.include("**/*${rule.fileExtension}")
            for (excl in excludes) {
                tree.exclude(excl)
            }
            for (file in tree.files) {
                val canonical = file.canonicalFile
                if (seen.add(canonical)) {
                    results.add(ResolvedFile(file, rule.commentStyle))
                }
            }
        }
        return results
    }

    private data class ResolvedRule(
        val absoluteFolder: File,
        val fileExtension: String,
        val commentStyle: CommentStyle
    )
}
