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

import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldNotBe
import org.gradle.api.Project
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Test

private class LicensePluginTest {

    companion object {
        private const val PLUGIN_ID = "com.mgmtp.a12.scripting.license"
    }

    private fun applyPluginUnderTest(): Project {
        val project = ProjectBuilder.builder().build()
        project.pluginManager.apply(PLUGIN_ID)
        return project
    }

    private fun evaluateProject(project: Project) {
        (project as org.gradle.api.internal.project.ProjectInternal).evaluate()
    }

    @Test
    fun `should register checkLicenses and formatLicenses tasks`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        project.tasks.findByName("checkLicenses") shouldNotBe null
        project.tasks.findByName("formatLicenses") shouldNotBe null
    }

    @Test
    fun `should register licenseFormat as an alias for formatLicenses`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        val licenseFormat = project.tasks.getByName("licenseFormat")
        val formatLicenses = project.tasks.getByName("formatLicenses")
        licenseFormat.taskDependencies.getDependencies(licenseFormat) shouldContain formatLicenses
    }

    @Test
    fun `should create the licenseHeaders extension`() {
        // given/when
        val project = applyPluginUnderTest()

        // then
        project.extensions.findByType(LicenseExtension::class.java) shouldNotBe null
    }

    @Test
    fun `should wire checkLicenses into the check lifecycle task`() {
        // given
        val project = applyPluginUnderTest()

        // when
        evaluateProject(project)

        // then
        val checkTask = project.tasks.getByName("check")
        val checkLicensesTask = project.tasks.getByName("checkLicenses")
        checkTask.taskDependencies.getDependencies(checkTask) shouldContain checkLicensesTask
    }
}
