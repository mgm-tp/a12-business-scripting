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

import com.mgmtp.a12.scripting.gradle.plugins.conventions.functional.ConventionsFixtureBuild
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.gradle.testkit.runner.TaskOutcome
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * GradleRunner coverage for npmTest's up-to-date behaviour. [NpmConventionsPluginTest] only proves
 * task wiring through `ProjectBuilder`, which never executes a task, so it cannot show what
 * Gradle's up-to-date check actually does across two real invocations.
 */
private class NpmTestUpToDateFunctionalTest {

    companion object {
        private const val MODULE_NAME = "fixture-npm-test-module"
        private const val NPM_TEST_TASK_PATH = ":$MODULE_NAME:npmTest"
        private const val TEST_SOURCE_RELATIVE_PATH = "src/test/example.test.ts"
    }

    @TempDir
    lateinit var rootDirectory: File

    private lateinit var fixture: ConventionsFixtureBuild
    private lateinit var moduleDirectory: File

    @BeforeEach
    fun setUpFixture() {
        fixture = ConventionsFixtureBuild(rootDirectory)
        fixture.writeSettingsIncluding(MODULE_NAME)
        // The fixture's "test" script is a no-op, so only npmTest's up-to-date wiring is under test.
        moduleDirectory = fixture.writeNpmModule(MODULE_NAME)
    }

    @Test
    fun `should leave npmTest up to date on a second run with unchanged sources`() {
        // given
        fixture.runGradle(NPM_TEST_TASK_PATH)

        // when
        val secondResult = fixture.runGradle(NPM_TEST_TASK_PATH)

        // then
        secondResult.task(NPM_TEST_TASK_PATH)?.outcome shouldBe TaskOutcome.UP_TO_DATE
    }

    @Test
    fun `should rerun npmTest after a test source file is added`() {
        // given
        fixture.runGradle(NPM_TEST_TASK_PATH)
        moduleDirectory.resolve(TEST_SOURCE_RELATIVE_PATH).apply {
            parentFile.mkdirs()
            writeText("export {}")
        }

        // when
        val secondResult = fixture.runGradle(NPM_TEST_TASK_PATH)

        // then
        secondResult.task(NPM_TEST_TASK_PATH)?.outcome shouldNotBe TaskOutcome.UP_TO_DATE
    }
}
