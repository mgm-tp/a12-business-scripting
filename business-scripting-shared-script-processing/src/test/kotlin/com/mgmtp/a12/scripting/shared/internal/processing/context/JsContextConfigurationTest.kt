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

import com.mgmtp.a12.scripting.shared.internal.config.ScriptLocationResolver
import io.kotest.matchers.shouldBe
import org.graalvm.polyglot.Engine
import org.graalvm.polyglot.Source
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

private class JsContextConfigurationTest {

    private val jsContextConfiguration = JsContextConfiguration()
    private val engine = Engine.create("js")

    @AfterEach
    fun closeEngine() {
        engine.close()
    }

    @Nested
    inner class ScriptLocationIoAccessProviderBean {

        @Test
        fun `should create a provider that allows imports from a configured script location`(@TempDir scriptLocation: Path) {
            // given
            Files.writeString(scriptLocation.resolve("marker.js"), "export const answer = 42;")
            val importingScript = Source
                .newBuilder("js", "export { answer } from './marker.js';", "entry.mjs")
                .mimeType("application/javascript+module")
                .build()

            // when
            val ioAccessProvider = jsContextConfiguration.scriptLocationIoAccessProvider(ScriptLocationResolver(listOf("file:$scriptLocation")))

            // then
            JsContextFactory(engine, emptyList(), ioAccessProvider).createContext(scriptLocation).use { context ->
                context.eval(importingScript).getMember("answer").asInt() shouldBe 42
            }
        }
    }
}
