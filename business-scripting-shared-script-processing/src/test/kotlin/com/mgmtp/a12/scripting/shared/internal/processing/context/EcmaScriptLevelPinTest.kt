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

import io.kotest.matchers.shouldBe
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.Test

/**
 * Pins the engine's ECMAScript level to the esbuild `target` scripts are transpiled to. An engine
 * upgrade that moves the level fails here instead of in a deployment, where a script would carry
 * syntax the engine cannot parse.
 */
private class EcmaScriptLevelPinTest {

    companion object {
        private const val ECMASCRIPT_VERSION_OPTION = "js.ecmascript-version"

        /** The `target` `business-scripting-devtools` pins its esbuild configuration to. */
        private const val PINNED_ESBUILD_TARGET = "es2025"

        /** GraalJS numbers the levels from ES2015, which it calls 6. */
        private const val ENGINE_LEVEL_OF_ES2015 = 6
    }

    private fun toEsbuildTarget(engineEcmaScriptLevel: Int) = "es${2015 + engineEcmaScriptLevel - ENGINE_LEVEL_OF_ES2015}"

    @Test
    fun `should transpile scripts to the ECMAScript level the engine defaults to`() {
        // when — reading the level the language itself reports, not the "latest" alias it is named by
        val engineEcmaScriptLevel = Engine.create("js").use { engine ->
            engine.languages
                .getValue("js")
                .options
                .get(ECMASCRIPT_VERSION_OPTION)
                .key.defaultValue as Int
        }

        // then
        toEsbuildTarget(engineEcmaScriptLevel) shouldBe PINNED_ESBUILD_TARGET
    }
}
