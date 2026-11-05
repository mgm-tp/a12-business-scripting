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

import com.mgmtp.a12.dataservices.document.DocumentService
import com.mgmtp.a12.dataservices.document.internal.kernel.KernelDocumentService
import com.mgmtp.a12.dataservices.query.QueryService
import com.mgmtp.a12.dataservices.relationship.RelationshipLinkService
import com.mgmtp.a12.dataservices.relationship.validation.RelationshipValidationSupport
import com.mgmtp.a12.kernel.md.model.api.services.IDocumentModelResolver
import com.mgmtp.a12.scripting.dataservices.callable.CallableScriptsConstants.SCRIPT_TYPE_DESCRIPTION
import com.mgmtp.a12.scripting.shared.internal.config.ScriptLocationResolver
import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptInvoker
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptTypeConverter
import com.mgmtp.a12.scripting.shared.internal.loading.ScriptLoader
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptEvaluator
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptRegistry
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptTypeValidator
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptExecutionFailureReporter
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptFailureSanitizer
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.ObjectMapper

@Configuration
@EnableConfigurationProperties(ScriptingProperties::class)
class CallableScriptConfiguration(
    private val documentService: DocumentService,
    private val queryService: QueryService,
    private val relationshipLinkService: RelationshipLinkService,
    private val relationshipValidationSupport: RelationshipValidationSupport,
    private val kernelDocumentService: KernelDocumentService,
    private val eventPublisher: ApplicationEventPublisher,
    private val documentModelResolver: IDocumentModelResolver,
    private val objectMapper: ObjectMapper,
    private val scriptingProperties: ScriptingProperties,
) {

    @Bean
    fun scriptEvaluator(jsContextFactory: JsContextFactory, scriptTypeValidator: ScriptTypeValidator) = ScriptEvaluator(jsContextFactory, scriptTypeValidator)

    @Bean
    fun scriptRegistry(scriptEvaluator: ScriptEvaluator) = ScriptRegistry(scriptingProperties, scriptEvaluator, SCRIPT_TYPE_DESCRIPTION)

    @Bean
    fun scriptInvoker(scriptTypeConverter: ScriptTypeConverter) = ScriptInvoker(scriptTypeConverter)

    @Bean
    fun callableScriptService(
        scriptRegistry: ScriptRegistry,
        jsContextFactory: JsContextFactory,
        scriptInvoker: ScriptInvoker,
        scriptExecutionFailureReporter: ScriptExecutionFailureReporter,
    ) = CallableScriptService(
        scriptRegistry,
        documentService,
        queryService,
        relationshipLinkService,
        relationshipValidationSupport,
        kernelDocumentService,
        eventPublisher,
        jsContextFactory,
        documentModelResolver,
        scriptInvoker,
        scriptExecutionFailureReporter,
    )

    @Bean
    fun callScriptOperation(
        callableScriptService: CallableScriptService,
        scriptFailureSanitizer: ScriptFailureSanitizer,
    ) = CallScriptOperation(callableScriptService, objectMapper, scriptFailureSanitizer)

    @Bean
    fun scriptLoader(
        scriptRegistry: ScriptRegistry,
        scriptingProperties: ScriptingProperties,
        scriptLocationResolver: ScriptLocationResolver,
    ): ScriptLoader = ScriptLoader(
        scriptLocationResolver = scriptLocationResolver,
        chunkNamePrefixes = scriptingProperties.chunkNamePrefixes,
        scriptTypeDescription = SCRIPT_TYPE_DESCRIPTION,
        registerExistingScriptsAtStartup = scriptingProperties.autoRegister.enabled,
        watchForNewScripts = scriptingProperties.autoLoad.enabled,
        register = scriptRegistry::register,
    )
}
