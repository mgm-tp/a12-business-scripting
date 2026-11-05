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
import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.dataservices.relationship.RelationshipLink
import com.mgmtp.a12.dataservices.relationship.RelationshipLinkService
import com.mgmtp.a12.dataservices.relationship.exception.RelationshipLinkEntityInvalidException
import com.mgmtp.a12.dataservices.relationship.exception.RelationshipModelMismatchException
import com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor
import com.mgmtp.a12.dataservices.relationship.spec.RelationshipRoleSpec
import com.mgmtp.a12.dataservices.relationship.validation.RelationshipValidationSupport
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.Called
import io.mockk.every
import io.mockk.justRun
import io.mockk.mockk
import io.mockk.verify
import io.mockk.verifyOrder
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

private class LinkSpecVerifierTest {

    companion object {
        const val LINK_ID = "link-1"
        const val RELATIONSHIP_MODEL_NAME = "Project_Employee_RM"
        const val OTHER_RELATIONSHIP_MODEL_NAME = "Other_RM"
        const val DATABASE_UNAVAILABLE_MESSAGE = "Database unavailable"
        const val BLANK_ROLE_MESSAGE = "Role name must not be blank"
        val LINK_DESCRIPTOR = LinkDescriptor(
            RELATIONSHIP_MODEL_NAME,
            listOf(
                RelationshipRoleSpec("Project", DocumentReference("Project_DM", "1")),
                RelationshipRoleSpec("Employee", DocumentReference("Employee_DM", "1")),
            ),
        )
    }

    private val relationshipLinkService: RelationshipLinkService = mockk()
    private val relationshipValidationSupport: RelationshipValidationSupport = mockk()
    private val storedLink: RelationshipLink = mockk()
    private val linkSpecVerifier = LinkSpecVerifier(relationshipLinkService, relationshipValidationSupport)

    @BeforeEach
    fun storeLinkAndAcceptSpec() {
        every { relationshipLinkService.load(LINK_ID) } returns storedLink
        justRun { relationshipValidationSupport.validateLinkCharacteristic(LINK_DESCRIPTOR) }
        justRun { relationshipValidationSupport.validateLink(storedLink, LINK_DESCRIPTOR) }
    }

    @Test
    fun `should check the spec is complete before matching it against the stored link`() {
        // when
        shouldNotThrowAny { linkSpecVerifier.verifyLinkSpecIsCompleteAndMatchesStoredLink(LINK_ID, LINK_DESCRIPTOR) }

        // then
        verifyOrder {
            relationshipValidationSupport.validateLinkCharacteristic(LINK_DESCRIPTOR)
            relationshipValidationSupport.validateLink(storedLink, LINK_DESCRIPTOR)
        }
    }

    @Test
    fun `should skip all checks for a link id that is not stored`() {
        // given
        every { relationshipLinkService.load(LINK_ID) } throws NotFoundException("Link not found")

        // when
        shouldNotThrowAny { linkSpecVerifier.verifyLinkSpecIsCompleteAndMatchesStoredLink(LINK_ID, LINK_DESCRIPTOR) }

        // then
        verify { relationshipValidationSupport wasNot Called }
    }

    @Test
    fun `should pass on a failure to load the stored link other than NotFoundException`() {
        // given
        every { relationshipLinkService.load(LINK_ID) } throws IllegalStateException(DATABASE_UNAVAILABLE_MESSAGE)

        // when / then
        shouldThrow<IllegalStateException> {
            linkSpecVerifier.verifyLinkSpecIsCompleteAndMatchesStoredLink(LINK_ID, LINK_DESCRIPTOR)
        }
    }

    @Test
    fun `should pass on an incomplete spec without matching it against the stored link`() {
        // given
        every {
            relationshipValidationSupport.validateLinkCharacteristic(LINK_DESCRIPTOR)
        } throws RelationshipLinkEntityInvalidException(BLANK_ROLE_MESSAGE)

        // when
        shouldThrow<RelationshipLinkEntityInvalidException> {
            linkSpecVerifier.verifyLinkSpecIsCompleteAndMatchesStoredLink(LINK_ID, LINK_DESCRIPTOR)
        }

        // then
        verify(exactly = 0) { relationshipValidationSupport.validateLink(any<RelationshipLink>(), any()) }
    }

    @Test
    fun `should pass on a spec that does not match the stored link`() {
        // given
        every {
            relationshipValidationSupport.validateLink(storedLink, LINK_DESCRIPTOR)
        } throws RelationshipModelMismatchException(LINK_ID, RELATIONSHIP_MODEL_NAME, OTHER_RELATIONSHIP_MODEL_NAME)

        // when / then
        shouldThrow<RelationshipModelMismatchException> {
            linkSpecVerifier.verifyLinkSpecIsCompleteAndMatchesStoredLink(LINK_ID, LINK_DESCRIPTOR)
        }
    }
}
