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

package com.mgmtp.a12.scripting.shared.internal.config

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.boot.context.properties.bind.BindException
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource

private class ScriptingPropertiesTest {

    companion object {
        const val SCRIPT_LOCATIONS_KEY = ScriptingProperties.SCRIPT_LOCATIONS_PROPERTY
        const val FILE_SCRIPT_LOCATION = "file:/app/scripts"
        const val CLASSPATH_SCRIPT_LOCATION = "classpath:scripts"
        const val DEFAULT_CHUNK_NAME_PREFIX = "shared-lib-"
    }

    private fun bind(properties: Map<String, String>): ScriptingProperties = Binder(MapConfigurationPropertySource(properties))
        .bindOrCreate(ScriptingProperties.PREFIX, ScriptingProperties::class.java)

    private fun rootCauseMessageOfFailedBinding(properties: Map<String, String>): String {
        val exception = shouldThrow<BindException> { bind(properties) }
        return generateSequence(exception as Throwable) { it.cause }.last().message.orEmpty()
    }

    @Nested
    inner class Binding {

        @Test
        fun `should bind a single script location`() {
            bind(mapOf(SCRIPT_LOCATIONS_KEY to FILE_SCRIPT_LOCATION)).scriptLocations shouldContainExactly listOf(FILE_SCRIPT_LOCATION)
        }

        @Test
        fun `should bind several comma-separated script locations`() {
            val scriptingProperties = bind(mapOf(SCRIPT_LOCATIONS_KEY to "$FILE_SCRIPT_LOCATION,$CLASSPATH_SCRIPT_LOCATION"))

            scriptingProperties.scriptLocations shouldContainExactly listOf(FILE_SCRIPT_LOCATION, CLASSPATH_SCRIPT_LOCATION)
        }

        @Test
        fun `should default every optional property when only the script locations are configured`() {
            // given — only the required property is set, every other property relies on its default
            val scriptingProperties = bind(mapOf(SCRIPT_LOCATIONS_KEY to FILE_SCRIPT_LOCATION))

            // then — auto-load and hot-reload are development-only features and must be opt-in
            scriptingProperties.autoRegister.enabled shouldBe true
            scriptingProperties.autoLoad.enabled shouldBe false
            scriptingProperties.hotReload.enabled shouldBe false
            scriptingProperties.chunkNamePrefixes shouldContainExactly listOf(DEFAULT_CHUNK_NAME_PREFIX)
            // and — exposing source locations in surfaced errors is a security decision, so an
            // unconfigured deployment must be the secure one
            scriptingProperties.errorMessages.includeSourceLocation shouldBe false
        }

        @Test
        fun `should bind source-location exposure to enabled when configured`() {
            // when
            val scriptingProperties = bind(
                mapOf(
                    SCRIPT_LOCATIONS_KEY to FILE_SCRIPT_LOCATION,
                    "${ScriptingProperties.ErrorMessages.PREFIX}.include-source-location" to "true",
                ),
            )

            // then
            scriptingProperties.errorMessages.includeSourceLocation shouldBe true
        }

        @Test
        fun `should fail binding with an error naming the property when no script location is configured`() {
            rootCauseMessageOfFailedBinding(emptyMap()) shouldContain "scriptLocations"
        }

        @Test
        fun `should fail binding with an error naming the property when the script locations are configured empty`() {
            rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to "")) shouldContain "$SCRIPT_LOCATIONS_KEY must name at least one directory"
        }

        @Test
        fun `should reject a location whose path part contains a glob`() {
            val rootCauseMessage = rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to "file:/app/scripts/**/*.js"))

            rootCauseMessage shouldContain "must be a directory"
        }

        @Test
        fun `should reject a location whose glob sits before the scheme separator`() {
            // '**:/etc' has no known scheme, so the glob must be caught in what would otherwise pass as a scheme
            val rootCauseMessage = rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to "**:/etc"))

            rootCauseMessage shouldContain "must be a directory"
        }

        @Test
        fun `should accept a classpath star location`() {
            bind(mapOf(SCRIPT_LOCATIONS_KEY to "classpath*:scripts")).scriptLocations shouldContainExactly listOf("classpath*:scripts")
        }

        @Test
        fun `should reject a blank entry left by a trailing comma, which would otherwise resolve to the classpath root`() {
            // given — the blank second entry resolves to the classpath root and would widen the import sandbox to it
            val rootCauseMessage = rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to "$FILE_SCRIPT_LOCATION,"))

            // then
            rootCauseMessage shouldContain "must name a directory"
        }

        @Test
        fun `should trim padding around a location so that validation and resolution read the same value`() {
            // given — an indexed entry keeps the padding a comma-separated value would lose
            val scriptingProperties = bind(mapOf("$SCRIPT_LOCATIONS_KEY[0]" to " $FILE_SCRIPT_LOCATION "))

            // then — padding is dropped once, here, so the resolver never sees a value whose scheme it would miss
            scriptingProperties.scriptLocations shouldContainExactly listOf(FILE_SCRIPT_LOCATION)
        }

        @Test
        fun `should reject a root location whose scheme is preceded by whitespace`() {
            // given — an indexed entry keeps the padding a comma-separated value would lose; ' file:/' names the file system root
            val rootCauseMessage = rootCauseMessageOfFailedBinding(mapOf("$SCRIPT_LOCATIONS_KEY[0]" to " file:/"))

            // then — the padding must not hide the scheme from validation and let the root through as the relative path 'file:'
            rootCauseMessage shouldContain "must name a directory"
        }

        @Test
        fun `should reject a location containing traversal segments`() {
            // 'file:/app/scripts/..' denotes /app, which is not the directory the entry appears to name, and 'file:/..' the root
            listOf("file:/app/scripts/..", "file:/..", "classpath:.", "file:/app/./scripts").forEach { traversalLocation ->
                rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to traversalLocation)) shouldContain "must not contain"
            }
        }

        @Test
        fun `should reject a location containing an Ant wildcard other than a star`() {
            // Spring's AntPathMatcher treats '?' and '{' as patterns too, so a location must carry neither
            listOf("file:/app/script?", "file:/app/scr{a,b}").forEach { wildcardLocation ->
                rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to wildcardLocation)) shouldContain "must be a directory"
            }
        }

        @Test
        fun `should reject a location that carries nothing but a scheme`() {
            // 'file:' resolves to the file system root, 'classpath:' to the classpath root
            listOf("file:", "file:/", "classpath:", "classpath*:").forEach { schemeOnlyLocation ->
                rootCauseMessageOfFailedBinding(mapOf(SCRIPT_LOCATIONS_KEY to schemeOnlyLocation)) shouldContain "must name a directory"
            }
        }
    }
}
