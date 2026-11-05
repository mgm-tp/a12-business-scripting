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

package com.mgmtp.a12.scripting.gradle.plugins.conventions.npm

import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property

/**
 * Configuration for [NpmConventionsPlugin].
 *
 * Every property has a sensible default, so a module that follows the common layout
 * (TypeScript sources in `src`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`)
 * only needs to override what deviates from that layout.
 */
abstract class NpmConventionsExtension {

    companion object {
        private const val DEFAULT_COMPILE_OUTPUT_DIRECTORY = "dist"
        private const val TYPESCRIPT_BUILD_INFO_FILE = "tsconfig.tsbuildinfo"
        private const val DEFAULT_SOURCE_DIRECTORY = "src"
        private const val TSCONFIG_JSON = "tsconfig.json"
        private const val ESLINT_CONFIG = "eslint.config.mjs"
        private const val VITEST_CONFIG = "vitest.config.ts"
    }

    /** Whether the module has a `test` npm script. Enables `npmTest` and wires it into `check`. */
    abstract val runTests: Property<Boolean>

    /** Directory produced by `npmCompile`, relative to the project directory. */
    abstract val compileOutputDirectory: Property<String>

    /**
     * Files `npmCompile` writes outside [compileOutputDirectory], relative to the project directory, so
     * `clean` deletes them too. `tsc --build` records its incremental state in `tsconfig.tsbuildinfo`
     * beside `tsconfig.json`, and a clean that left it behind would leave the next compile believing
     * its output is current.
     */
    abstract val compileOutputFiles: ListProperty<String>

    /**
     * Directories holding the module's TypeScript sources, relative to the project directory. Each one
     * is tracked as an input of `npmCompile`, `npmLint` and `npmTest`. Set this when a module keeps its
     * sources in more than one directory, e.g. one per concern. Every configured directory must exist.
     */
    abstract val sourceDirectories: ListProperty<String>

    /** Configuration files (besides `src` and `package-lock.json`) tracked as inputs of `npmCompile`. */
    abstract val compileInputFiles: ListProperty<String>

    /** Configuration files (besides `src` and `package-lock.json`) tracked as inputs of `npmLint`. */
    abstract val lintInputFiles: ListProperty<String>

    /** Configuration files (besides `src` and `package-lock.json`) tracked as inputs of `npmTest`. */
    abstract val testInputFiles: ListProperty<String>

    /** Task paths that `npmInstall` must run after (e.g. other modules' `npmCompile`). */
    abstract val installDependsOnTasks: ListProperty<String>

    init {
        runTests.convention(true)
        compileOutputDirectory.convention(DEFAULT_COMPILE_OUTPUT_DIRECTORY)
        compileOutputFiles.convention(listOf(TYPESCRIPT_BUILD_INFO_FILE))
        sourceDirectories.convention(listOf(DEFAULT_SOURCE_DIRECTORY))
        compileInputFiles.convention(listOf(TSCONFIG_JSON))
        lintInputFiles.convention(listOf(ESLINT_CONFIG, TSCONFIG_JSON))
        testInputFiles.convention(listOf(VITEST_CONFIG))
        installDependsOnTasks.convention(emptyList())
    }
}
