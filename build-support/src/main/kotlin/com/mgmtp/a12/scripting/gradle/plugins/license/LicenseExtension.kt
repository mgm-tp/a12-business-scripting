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

import org.gradle.api.file.RegularFileProperty
import org.gradle.api.model.ObjectFactory
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.provider.SetProperty
import javax.inject.Inject

open class LicenseExtension @Inject constructor(objects: ObjectFactory) {

    /** The plain-text copyright header file (no comment markers). */
    val headerFile: RegularFileProperty = objects.fileProperty()

    /** Configured license-header scan rules. */
    val rules: ListProperty<LicenseHeaderRule> = objects.listProperty(LicenseHeaderRule::class.java)
        .convention(emptyList())

    /**
     * Root folder of the license scan, given as a path relative to the module root.
     * Each [LicenseHeaderRule] folder is resolved relative to this root.
     * Defaults to "." (the current module).
     */
    val folder: Property<String> = objects.property(String::class.java).convention(".")

    /** Glob patterns for paths to exclude from license checking/formatting. */
    val excludes: SetProperty<String> = objects.setProperty(String::class.java)
        .convention(
            setOf(
                "**/build/**",
                "**/test-output/**",
                "**/.gradle/**",
                "**/.*/**",
                "**/package-info.java"
            )
        )

    /**
     * Registers a license-header rule with an explicit subfolder.
     *
     * @param folder subfolder relative to the licenseHeaders root folder
     * @param fileExtension file extension including the leading dot (e.g. ".kt")
     * @param commentStyle the [CommentStyle] to use for matching files
     */
    fun rule(folder: String, fileExtension: String, commentStyle: CommentStyle) {
        rules.add(LicenseHeaderRule(folder, fileExtension, commentStyle))
    }

    /**
     * Registers a license-header rule that scans the whole root folder.
     *
     * @param fileExtension file extension including the leading dot (e.g. ".kt")
     * @param commentStyle the [CommentStyle] to use for matching files
     */
    fun rule(fileExtension: String, commentStyle: CommentStyle) {
        rule(".", fileExtension, commentStyle)
    }
}
