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

import com.mgmtp.a12.scripting.shared.api.ScriptTypeMapping
import com.mgmtp.a12.scripting.shared.api.ScriptTypeMappings
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptExecutionFailureReporter
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptFailureSanitizer
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.SmartInitializingSingleton
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class ScriptProcessingConfiguration {

    @Bean
    fun documentReferenceMapping() = documentReferenceScriptTypeMapping

    // The provider defers the lookup: a mapping that nests another type depends on this bean and would
    // otherwise have to exist before the list it belongs to can be built.
    @Bean
    fun scriptTypeMappings(mappingProvider: ObjectProvider<ScriptTypeMapping<*>>) = ScriptTypeMappings { mappingProvider.toList() }

    // Indexes the mappings at the one moment where the registry is provably complete: every singleton exists.
    @Bean
    fun scriptTypeMappingsIndexer(scriptTypeMappings: ScriptTypeMappings) = SmartInitializingSingleton { scriptTypeMappings.indexRegisteredMappings() }

    @Bean
    fun scriptTypeValidator(mappings: List<ScriptTypeMapping<*>>) = ScriptTypeValidator(mappings)

    @Bean
    fun scriptFailureSanitizer(scriptingProperties: ScriptingProperties) = ScriptFailureSanitizer(scriptingProperties)

    @Bean
    fun scriptExecutionFailureReporter(scriptFailureSanitizer: ScriptFailureSanitizer) = ScriptExecutionFailureReporter(scriptFailureSanitizer)
}
