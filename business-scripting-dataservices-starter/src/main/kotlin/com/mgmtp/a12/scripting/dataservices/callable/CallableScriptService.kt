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
import com.mgmtp.a12.dataservices.document.DocumentService
import com.mgmtp.a12.dataservices.document.internal.kernel.KernelDocumentService
import com.mgmtp.a12.dataservices.query.QueryService
import com.mgmtp.a12.dataservices.relationship.RelationshipLinkService
import com.mgmtp.a12.dataservices.relationship.validation.RelationshipValidationSupport
import com.mgmtp.a12.kernel.md.document.apiV2.services.IDocumentV2Serializer
import com.mgmtp.a12.kernel.md.facade.DocumentServiceFactory
import com.mgmtp.a12.kernel.md.model.api.services.IDocumentModelResolver
import com.mgmtp.a12.scripting.dataservices.callable.api.events.execution.BusinessScriptAfterExecuteEvent
import com.mgmtp.a12.scripting.dataservices.callable.api.events.execution.BusinessScriptBeforeExecuteEvent
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptInvoker
import com.mgmtp.a12.scripting.shared.internal.invoker.executeWithScriptLifecycleHooks
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptRegistry
import com.mgmtp.a12.scripting.shared.internal.processing.eval.evalEntryFunction
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptExecutionFailureReporter
import org.graalvm.polyglot.Context
import org.springframework.context.ApplicationEventPublisher

class CallableScriptService(
    private val scriptRegistry: ScriptRegistry,
    private val documentService: DocumentService,
    private val queryService: QueryService,
    private val relationshipLinkService: RelationshipLinkService,
    relationshipValidationSupport: RelationshipValidationSupport,
    private val kernelDocumentService: KernelDocumentService,
    private val eventPublisher: ApplicationEventPublisher,
    private val jsContextFactory: JsContextFactory,
    documentModelResolver: IDocumentModelResolver,
    private val scriptInvoker: ScriptInvoker,
    private val scriptExecutionFailureReporter: ScriptExecutionFailureReporter,
) {
    private val documentV2Serializer: IDocumentV2Serializer =
        DocumentServiceFactory(documentModelResolver).createDocumentV2Serializer()
    private val linkSpecVerifier = LinkSpecVerifier(relationshipLinkService, relationshipValidationSupport)

    fun callScript(
        scriptName: String,
        arguments: Map<String, Any?>,
    ): Map<String, Any?> {
        val parsed = scriptRegistry.get(scriptName)
            ?: throw NotFoundException("Callable script with name $scriptName not found")
        return executeWithHooks(arguments, parsed)
    }

    private fun executeWithHooks(
        arguments: Map<String, Any?>,
        parsed: ParsedScript,
    ): Map<String, Any?> = executeWithScriptLifecycleHooks(
        eventPublisher,
        BusinessScriptBeforeExecuteEvent(parsed.source.uri, parsed.scriptIdentifier, arguments),
        { exception -> BusinessScriptAfterExecuteEvent(parsed.source.uri, parsed.scriptIdentifier, arguments, exception) },
    ) {
        // A fresh context is created per invocation so that execution-context detection
        // (e.g. typeof documentService !== 'undefined') runs with the bindings already in place.
        // Sharing the Engine across contexts keeps GraalVM's compiled code cache intact.
        jsContextFactory.createContext(parsed.currentWorkingDirectory).use { ctx ->
            populateExecutionContext(ctx, arguments)
            // Reported inside the open Context: resolving the failing script line is context-bound.
            scriptExecutionFailureReporter.logAndRethrowSanitizingScriptFailures(parsed) {
                val scriptFn = ctx.evalEntryFunction(parsed.source, parsed.scriptFileName)
                scriptInvoker.invokeScriptFunction(
                    ctx,
                    scriptFn,
                    parsed.params,
                    parsed.returnProperties,
                    arguments,
                )
            }
        }
    }

    private fun populateExecutionContext(context: Context, arguments: Map<String, Any?>) {
        context.getBindings("js").apply {
            putMember("documentService", documentService)
            putMember("queryService", queryService)
            putMember("documentV2Serializer", documentV2Serializer)
            putMember("relationshipLinkService", relationshipLinkService)
            putMember("linkSpecVerifier", linkSpecVerifier)
            putMember("kernelDocumentService", kernelDocumentService)
            putMember(
                "scriptCaller",
                ScriptCaller(::callScript),
            )
            putMember("params", arguments)
        }
    }
}
