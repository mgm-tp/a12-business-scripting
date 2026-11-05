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

package com.mgmtp.a12.scripting.cibseven.api.delegate

import com.mgmtp.a12.scripting.cibseven.api.events.execution.BusinessScriptAfterExecuteEvent
import com.mgmtp.a12.scripting.cibseven.api.events.execution.BusinessScriptBeforeExecuteEvent
import com.mgmtp.a12.scripting.rpcFacade.internal.DataServicesRpcFacade
import com.mgmtp.a12.scripting.shared.internal.invoker.ScriptInvoker
import com.mgmtp.a12.scripting.shared.internal.invoker.executeWithScriptLifecycleHooks
import com.mgmtp.a12.scripting.shared.internal.processing.context.JsContextFactory
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ParsedScript
import com.mgmtp.a12.scripting.shared.internal.processing.eval.ScriptRegistry
import com.mgmtp.a12.scripting.shared.internal.processing.eval.evalEntryFunction
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptExecutionFailureReporter
import org.cibseven.bpm.engine.delegate.DelegateExecution
import org.cibseven.bpm.engine.delegate.JavaDelegate
import org.springframework.context.ApplicationEventPublisher
import org.springframework.web.context.support.GenericWebApplicationContext
import java.net.URL
import java.util.function.Supplier

class JsDelegateService(
    private val scriptRegistry: ScriptRegistry,
    private val applicationContext: GenericWebApplicationContext,
    private val dataServicesRpcFacade: DataServicesRpcFacade,
    private val eventPublisher: ApplicationEventPublisher,
    private val jsContextFactory: JsContextFactory,
    private val scriptInvoker: ScriptInvoker,
    private val scriptExecutionFailureReporter: ScriptExecutionFailureReporter,
) {
    internal fun registerScriptAsDelegate(scriptUrl: URL): String {
        val scriptIdentifier = scriptRegistry.register(scriptUrl)
        registerDelegateAsBean(scriptIdentifier, scriptUrl)
        return scriptIdentifier
    }

    private fun registerDelegateAsBean(scriptIdentifier: String, scriptUrl: URL) {
        applicationContext.registerBean(
            scriptIdentifier,
            JavaDelegate::class.java,
            Supplier {
                JavaDelegate { execution ->
                    val parsedScript = scriptRegistry.get(scriptIdentifier)
                        ?: throw IllegalArgumentException("Cannot create JavaDelegate for non-existent script! Reason: $scriptIdentifier could not be loaded from ScriptRegistry.")
                    executeWithHooks(scriptUrl, scriptIdentifier, execution) {
                        executeScript(parsedScript, execution)
                    }
                }
            },
        )
    }

    internal fun executeWithHooks(
        scriptUrl: URL,
        delegateName: String,
        execution: DelegateExecution,
        executeScript: () -> Unit,
    ) = executeWithScriptLifecycleHooks(
        eventPublisher,
        BusinessScriptBeforeExecuteEvent(scriptUrl, delegateName, execution),
        { exception -> BusinessScriptAfterExecuteEvent(scriptUrl, delegateName, execution, exception) },
        executeScript,
    )

    private fun executeScript(parsedScript: ParsedScript, execution: DelegateExecution) {
        jsContextFactory.createContext(parsedScript.currentWorkingDirectory).use { ctx ->
            ctx.getBindings("js").putMember("dataServicesRpcFacade", dataServicesRpcFacade)
            // Reported inside the open Context: resolving the failing script line is context-bound.
            val result = scriptExecutionFailureReporter.logAndRethrowSanitizingScriptFailures(parsedScript) {
                val scriptFn = ctx.evalEntryFunction(parsedScript.source, parsedScript.scriptFileName)
                val variables = parsedScript.params.keys
                    .filter { execution.hasVariable(it) }
                    .associateWith { execution.getVariable(it) }
                scriptInvoker.invokeScriptFunction(
                    ctx,
                    scriptFn,
                    parsedScript.params,
                    parsedScript.returnProperties,
                    variables,
                )
            }
            for ((name, value) in result) {
                execution.setVariable(name, value)
            }
        }
    }
}
