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

package com.mgmtp.a12.scripting.shared.internal.functions

import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

@DisplayName("Source map remapper")
private class SourceMapRemapperTest {

    companion object {
        private const val TS_SOURCE_FILE = "script.ts"

        private fun sourceMapOf(mappings: String, sources: List<String> = listOf(TS_SOURCE_FILE)): String {
            val sourcesJson = sources.joinToString(",") { "\"$it\"" }
            return """{"version":3,"sources":[$sourcesJson],"mappings":"$mappings","names":[]}"""
        }
    }

    @Nested
    @DisplayName("VLQ decoding")
    inner class VlqDecoding {

        @Test
        fun `should decode simple segment AAAA as all zeros`() {
            decodeVlqSegment("AAAA") shouldContainExactly listOf(0, 0, 0, 0)
        }

        @Test
        fun `should decode segment with positive source line delta`() {
            // AASA = col 0, source 0, source line +9, col 0
            decodeVlqSegment("AASA") shouldContainExactly listOf(0, 0, 9, 0)
        }

        @Test
        fun `should decode segment with negative delta`() {
            // D = VLQ for -2: value 2, sign bit set -> 2*2+1 = 5 -> 'F' wait let me recalculate
            // -1 in VLQ: abs=1, negative, so (1 << 1) | 1 = 3 -> 'D'
            decodeVlqSegment("D") shouldContainExactly listOf(-1)
        }

        @Test
        fun `should decode multi-byte VLQ values`() {
            // 16 in VLQ: 16 << 1 = 32 -> needs two base64 chars
            // first char: 32 & 0x1F = 0, continuation bit set -> 0 | 0x20 = 32 -> 'g'
            // second char: 32 >> 5 = 1 -> 'B'
            decodeVlqSegment("gB") shouldContainExactly listOf(16)
        }
    }

    @Nested
    @DisplayName("remapLineFromSourceMap")
    inner class RemapLine {

        @Test
        fun `should map JS line to TS line using simple source map`() {
            // given - AASA maps generated line 0 to source line 9 (0-indexed) = line 10 (1-indexed)
            val sourceMap = sourceMapOf("AASA")

            // when
            val result = remapLineFromSourceMap(sourceMap, jsLine = 1)

            // then
            result shouldBe OriginalSourceLocation(TS_SOURCE_FILE, line = 10)
        }

        @Test
        fun `should handle wrapper offset with leading empty lines`() {
            // given - ";AASA" = line 0 unmapped, line 1 maps to source line 9
            val sourceMap = sourceMapOf(";AASA")

            // when / then
            remapLineFromSourceMap(sourceMap, jsLine = 1).shouldBeNull()
            remapLineFromSourceMap(sourceMap, jsLine = 2) shouldBe OriginalSourceLocation(TS_SOURCE_FILE, line = 10)
        }

        @Test
        fun `should accumulate source line deltas across lines`() {
            // given - line 0: source line 4, line 1: source line 4+3=7
            // AAIA = col 0, src 0, srcLine +4, col 0
            // AAGA = col 0, src 0, srcLine +3, col 0
            val sourceMap = sourceMapOf("AAIA;AAGA")

            // when / then
            remapLineFromSourceMap(sourceMap, jsLine = 1) shouldBe OriginalSourceLocation(TS_SOURCE_FILE, line = 5)
            remapLineFromSourceMap(sourceMap, jsLine = 2) shouldBe OriginalSourceLocation(TS_SOURCE_FILE, line = 8)
        }

        @Test
        fun `should return null for line beyond mappings range`() {
            val sourceMap = sourceMapOf("AAAA")

            remapLineFromSourceMap(sourceMap, jsLine = 99).shouldBeNull()
        }

        @Test
        fun `should return null when the source map holds no mappings`() {
            remapLineFromSourceMap("""{"version":3,"sources":["script.ts"]}""", jsLine = 1).shouldBeNull()
        }

        @Test
        fun `should handle multiple source files`() {
            // given - line 0: source 0, line 2; line 1: source 1 (delta +1), line 0
            // AAEA = col 0, src 0, srcLine +2, col 0
            // ACAA = col 0, src +1, srcLine 0 (delta resets relative), col 0
            // wait — source line is cumulative too. src line delta from 2 to 0 is -2 = 'D' in VLQ
            // ACFA = col 0, src +1, srcLine -2, col 0
            val sourceMap = sourceMapOf("AAEA;ACFA", listOf("first.ts", "second.ts"))

            // when / then
            remapLineFromSourceMap(sourceMap, jsLine = 1) shouldBe OriginalSourceLocation("first.ts", line = 3)
            remapLineFromSourceMap(sourceMap, jsLine = 2) shouldBe OriginalSourceLocation("second.ts", line = 1)
        }
    }
}
