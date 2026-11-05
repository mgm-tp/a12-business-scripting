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

package com.mgmtp.a12.scripting.shared.internal.processing.eval

import com.mgmtp.a12.dataservices.document.DocumentReference
import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import com.mgmtp.a12.scripting.shared.api.ScriptTypeMappings
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

private const val LABELS = "labels"
private const val DOCUMENT_REFERENCE = "documentReference"
private const val CONTAINER_MAPPING_BEAN = "labelContainerMapping"

data class NestedLabel(val label: String)

data class LabelContainer(val labels: List<NestedLabel>, val documentReference: DocumentReference)

/**
 * A container mapping that resolves a type registered beside it and one registered by Business Scripting,
 * so that both are missing from the registry if it is indexed before every mapping bean exists.
 */
@Configuration
open class LabelContainerMappingConfiguration {

    // Required by another bean of ScriptProcessingConfiguration, unrelated to the mappings under test
    @Bean
    open fun scriptingProperties() = ScriptingProperties(scriptLocations = listOf("classpath:scripts"))

    @Bean
    open fun nestedLabelMapping() = ScriptTypeMapping(
        typeName = "NestedLabel",
        targetType = NestedLabel::class.java,
        parseInput = { raw -> (raw as? String)?.let(::NestedLabel) },
    )

    @Bean
    open fun labelContainerMapping(scriptTypeMappings: ScriptTypeMappings) = ScriptTypeMapping(
        typeName = "LabelContainer",
        targetType = LabelContainer::class.java,
        parseInput = { raw -> labelContainerFromExecutionContextValue(raw, scriptTypeMappings) },
    )
}

private fun labelContainerFromExecutionContextValue(raw: Any, mappings: ScriptTypeMappings): LabelContainer? {
    val map = raw as? Map<*, *> ?: return null
    val labels = mappings.listFieldOrNull(map, LABELS, NestedLabel::class.java) ?: return null
    val documentReference = mappings.fieldOrNull(map, DOCUMENT_REFERENCE, DocumentReference::class.java) ?: return null
    return LabelContainer(labels, documentReference)
}

private class ScriptTypeMappingsWiringTest {

    @Test
    fun `should resolve nested types of a mapping that is itself one of the registered mappings`() {
        AnnotationConfigApplicationContext(
            ScriptProcessingConfiguration::class.java,
            LabelContainerMappingConfiguration::class.java,
        ).use { context ->
            // given a container carrying a type of its own project and one Business Scripting registers
            val containerMapping = context.getBean(CONTAINER_MAPPING_BEAN, ScriptTypeMapping::class.java)
            val rawContainer = mapOf(LABELS to listOf("first", "second"), DOCUMENT_REFERENCE to "Project_DM/1")

            // when
            val container = containerMapping.parseInputOrNull(rawContainer)

            // then
            container shouldBe LabelContainer(
                listOf(NestedLabel("first"), NestedLabel("second")),
                DocumentReference("Project_DM/1"),
            )
        }
    }

    @Test
    fun `should hold every registered mapping, whichever bean asks first`() {
        AnnotationConfigApplicationContext(
            ScriptProcessingConfiguration::class.java,
            LabelContainerMappingConfiguration::class.java,
        ).use { context ->
            // given
            val mappings = context.getBean(ScriptTypeMappings::class.java)
            val rawWithUnknownLabel = mapOf(LABELS to listOf(42), DOCUMENT_REFERENCE to "Project_DM/1")

            // then a mapping is registered for both nested types, and the rejection comes from the value, not from a gap
            mappings.listFieldOrNull(rawWithUnknownLabel, LABELS, NestedLabel::class.java) shouldBe null
            mappings.fieldOrNull(rawWithUnknownLabel, DOCUMENT_REFERENCE, DocumentReference::class.java) shouldBe
                DocumentReference("Project_DM/1")
        }
    }
}
