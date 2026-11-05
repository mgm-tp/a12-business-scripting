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

package com.mgmtp.a12.scripting.dataservices.callable

import com.mgmtp.a12.dataservices.common.exception.NotFoundException
import com.mgmtp.a12.dataservices.relationship.RelationshipLink
import com.mgmtp.a12.dataservices.relationship.RelationshipLinkService
import com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor
import com.mgmtp.a12.dataservices.relationship.validation.RelationshipValidationSupport

/**
 * Runs the checks the DELETE_LINK RPC runs before it deletes a link, which [RelationshipLinkService.delete]
 * skips. Scripts call it for every link spec before deleting any, so a list with one bad spec deletes nothing.
 */
class LinkSpecVerifier(
    private val relationshipLinkService: RelationshipLinkService,
    private val relationshipValidationSupport: RelationshipValidationSupport,
) {

    /**
     * Throws the Data Services validation exception when the spec is incomplete or does not match the stored
     * link. A link id that is not stored needs no verification, as in DELETE_LINK.
     */
    fun verifyLinkSpecIsCompleteAndMatchesStoredLink(linkId: String, linkDescriptor: LinkDescriptor) {
        val storedLink = loadStoredLinkOrNull(linkId) ?: return
        relationshipValidationSupport.validateLinkCharacteristic(linkDescriptor)
        relationshipValidationSupport.validateLink(storedLink, linkDescriptor)
    }

    private fun loadStoredLinkOrNull(linkId: String): RelationshipLink? = try {
        relationshipLinkService.load(linkId)
    } catch (_: NotFoundException) {
        null
    }
}
