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

import java.util.Base64

/** Matches an inline source map comment with a base64-encoded data URI, capturing the base64 payload. */
val INLINE_SOURCE_MAP_COMMENT = Regex("""//[#@] sourceMappingURL=data:application/json;base64,(.+)$""")

/** Captures the VLQ-encoded "mappings" string. */
val SOURCE_MAP_MAPPINGS_FIELD = Regex(""""mappings"\s*:\s*"([^"]*)"""")

/**
 * Extracts the inline source map JSON from a script by finding the base64-encoded
 * sourceMappingURL comment and decoding it.
 *
 * @param script The script content potentially containing an inline source map comment.
 * @return The decoded source map JSON string, or null if no inline source map is found.
 */
fun extractSourceMapJson(script: String): String? {
    val base64Payload = script
        .lines()
        .asReversed()
        .firstNotNullOfOrNull { INLINE_SOURCE_MAP_COMMENT.find(it) }
        ?.groupValues
        ?.get(1)
        ?.trim()
        ?: return null

    return String(Base64.getDecoder().decode(base64Payload))
}
