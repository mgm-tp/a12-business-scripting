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

package com.mgmtp.a12.scripting.cibseven.exploration

import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.context.ScriptLocationIoAccessProvider
import io.kotest.matchers.shouldBe
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.Test

class GraalJsBindingsExplorationTest {
    val jsContextFactory = JsContextFactory(Engine.create("js"), emptyList(), ScriptLocationIoAccessProvider(emptyList()))

    @Test
    fun `should find JS bindings on top level`() {
        // given
        val ctx = jsContextFactory.createContext()
        ctx.getBindings("js").putMember("someValue", 42)

        // when
        val result = ctx.eval(
            "js",
            // language=js
            """
                    function inc(x) {
                        return x + 1;
                    }

                    inc(someValue);
                    """,
        )

        // then
        result.asInt() shouldBe 43
    }

    @Test
    fun `should find bindings via declare on top level`() {
        // given
        val ctx = jsContextFactory.createContext()
        ctx.getBindings("js").putMember("dataServicesRpcFacade", "bar")

        // when
        val result = ctx.eval(
            "js",
            // language=js
            """
            let executionContext;

            if (typeof dataServicesRpcFacade !== "undefined") {
                executionContext = {
                    dataServicesRpcFacade
                };
            }

            function isInEngineTaskContext(ctx) {
              return ctx !== void 0 && "dataServicesRpcFacade" in ctx;
            }

            let result;
            if (isInEngineTaskContext(executionContext)) {
                result = "yes";
            } else {
                result = "no";
            }

            result;
        """,
        )

        // then
        result.asString() shouldBe "yes"
    }
}
