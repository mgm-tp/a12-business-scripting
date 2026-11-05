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

package com.mgmtp.a12.scripting.shared.internal.processing.failure

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

private class ScriptLocationScrubbingTest {

    companion object {
        private const val DOCUMENT_NOT_FOUND_MESSAGE = "Document 'Project_DM/123' not found."
        private const val FIELD_PATH_MESSAGE = "Validation failed, path: \$.targetDocumentModel"

        /** The engine's own syntax error format, verified against GraalJS 25. */
        private const val SYNTAX_ERROR_MESSAGE = "SyntaxError: file:///opt/app/scripts/broken.js:1:10 Expected an operand but found ;"
    }

    @Nested
    inner class ReduceScriptLocationsToFileName {

        @Test
        fun `should reduce a build-relative source path to its file name`() {
            reduceScriptLocationsToFileName("failed at ../system-test-scripts/src/doc-not-found.ts:6") shouldBe
                "failed at doc-not-found.ts:6"
        }

        @Test
        fun `should reduce an absolute file URI to its file name`() {
            reduceScriptLocationsToFileName("Cannot load file:///opt/app/scripts/shared-lib-utils.js") shouldBe
                "Cannot load shared-lib-utils.js"
        }

        @Test
        fun `should reduce a jar URI to its file name`() {
            reduceScriptLocationsToFileName("Cannot load jar:file:/opt/app.jar!/scripts/doc-not-found.js") shouldBe
                "Cannot load doc-not-found.js"
        }

        @Test
        fun `should reduce a location carrying a line and a column to its file name`() {
            reduceScriptLocationsToFileName(SYNTAX_ERROR_MESSAGE) shouldBe "SyntaxError: broken.js:1:10 Expected an operand but found ;"
        }

        @Test
        fun `should leave a document reference untouched`() {
            reduceScriptLocationsToFileName(DOCUMENT_NOT_FOUND_MESSAGE) shouldBe DOCUMENT_NOT_FOUND_MESSAGE
        }

        @Test
        fun `should leave a field path untouched`() {
            reduceScriptLocationsToFileName(FIELD_PATH_MESSAGE) shouldBe FIELD_PATH_MESSAGE
        }
    }

    @Nested
    inner class DropLineAndColumnFromScriptLocations {

        @Test
        fun `should drop the line from a source file location`() {
            dropLineAndColumnFromScriptLocations("failed at doc-not-found.ts:6") shouldBe "failed at doc-not-found.ts"
        }

        @Test
        fun `should drop line and column from a source file location`() {
            dropLineAndColumnFromScriptLocations("SyntaxError: broken.js:1:10 Expected an operand but found ;") shouldBe
                "SyntaxError: broken.js Expected an operand but found ;"
        }

        @Test
        fun `should leave a number that is no source location untouched`() {
            dropLineAndColumnFromScriptLocations(DOCUMENT_NOT_FOUND_MESSAGE) shouldBe DOCUMENT_NOT_FOUND_MESSAGE
        }
    }
}
