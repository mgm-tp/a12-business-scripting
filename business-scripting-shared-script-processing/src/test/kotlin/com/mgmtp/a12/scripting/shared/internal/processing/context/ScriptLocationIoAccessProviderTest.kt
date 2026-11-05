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

package com.mgmtp.a12.scripting.shared.internal.processing.context

import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldInclude
import org.graalvm.polyglot.io.IOAccess
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

private class ScriptLocationIoAccessProviderTest {

    @Test
    fun `should grant file access to a script lying directly in a configured script location`(@TempDir scriptLocation: Path) {
        val provider = ScriptLocationIoAccessProvider(listOf(scriptLocation))

        provider.ioAccessForScriptDirectory(scriptLocation) shouldNotBe IOAccess.NONE
    }

    @Test
    fun `should grant file access to a script lying in a subdirectory of a configured script location`(@TempDir scriptLocation: Path) {
        val provider = ScriptLocationIoAccessProvider(listOf(scriptLocation))

        provider.ioAccessForScriptDirectory(scriptLocation.resolve("sub")) shouldNotBe IOAccess.NONE
    }

    @Test
    fun `should build a separate file system per call so concurrent contexts cannot share a working directory`(@TempDir scriptLocation: Path) {
        val provider = ScriptLocationIoAccessProvider(listOf(scriptLocation))

        provider.ioAccessForScriptDirectory(scriptLocation) shouldNotBe provider.ioAccessForScriptDirectory(scriptLocation)
    }

    @Test
    fun `should fail naming the directory and the configured locations when the script lies below no configured location`(
        @TempDir scriptLocation: Path,
        @TempDir unconfiguredDirectory: Path,
    ) {
        // given — reaching this state means a script was registered from outside the configured locations
        val provider = ScriptLocationIoAccessProvider(listOf(scriptLocation))

        // when
        val exception = shouldThrow<IllegalStateException> { provider.ioAccessForScriptDirectory(unconfiguredDirectory) }

        // then — the message must name both what was asked for and what is configured, to be actionable
        val exceptionMessage = exception.message.orEmpty()
        exceptionMessage shouldInclude unconfiguredDirectory.toString()
        exceptionMessage shouldInclude scriptLocation.toString()
        exceptionMessage shouldInclude ScriptingProperties.SCRIPT_LOCATIONS_PROPERTY
    }
}
