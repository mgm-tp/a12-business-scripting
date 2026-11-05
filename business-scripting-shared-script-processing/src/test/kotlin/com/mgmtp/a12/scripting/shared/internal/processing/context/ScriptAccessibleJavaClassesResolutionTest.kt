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

import io.kotest.assertions.assertSoftly
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test

/**
 * Guards the allowlist against the classpath, not against the scripting API: a failure here means a class the
 * allowlist names is no longer resolvable, which is a dependency change rather than a wrong allowlist entry.
 */
private class ScriptAccessibleJavaClassesResolutionTest {

    companion object {
        private const val JACKSON_OBJECT_MAPPER = "com.fasterxml.jackson.databind.ObjectMapper"
    }

    private val engine = Engine.create("js")

    @AfterEach
    fun closeEngine() {
        engine.close()
    }

    @Test
    fun `should resolve every allowlisted class name through Java type`() {
        jsContextFactoryWithScriptsDirectories(engine).createContext().use { context ->
            assertSoftly {
                ScriptAccessibleJavaClasses.classNames.forEach { className ->
                    withClue("$className did not resolve — the test classpath no longer carries it") {
                        shouldNotThrowAny { context.eval("js", "Java.type('$className')") }
                    }
                }
            }
        }
    }

    @Test
    fun `should deny the object mapper that the audit rejected`() {
        // Asserted on the predicate rather than through a lookup: the object mapper is absent from this module's
        // test classpath, so a denied lookup would pass whether the allowlist named it or not.
        ScriptAccessibleJavaClasses.isAccessible(JACKSON_OBJECT_MAPPER) shouldBe false
    }
}
