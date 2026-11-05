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

import com.googlecode.jsonrpc4j.JsonRpcParam
import com.mgmtp.a12.dataservices.common.exception.NotFoundException
import com.mgmtp.a12.dataservices.rpc.RemoteOperation
import com.mgmtp.a12.dataservices.rpc.RemoteOperation.RemoteOperationHelper
import com.mgmtp.a12.dataservices.rpc.RpcExceptionSupport
import com.mgmtp.a12.scripting.shared.api.exceptions.ScriptExecutionException
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingOperationConstants.CALL_SCRIPT_OPERATION
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingRpcExceptionKeys.SCRIPT_EXECUTION_EXCEPTION
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingRpcExceptionKeys.SCRIPT_NOT_FOUND_EXCEPTION
import com.mgmtp.a12.scripting.shared.internal.functions.logFailure
import com.mgmtp.a12.scripting.shared.internal.functions.logger
import com.mgmtp.a12.scripting.shared.internal.processing.failure.ScriptFailureSanitizer
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper

@RemoteOperation(name = CALL_SCRIPT_OPERATION)
open class CallScriptOperation(
    private val callableScriptService: CallableScriptService,
    private val objectMapper: ObjectMapper,
    private val scriptFailureSanitizer: ScriptFailureSanitizer,
) {
    @PreAuthorize("hasUAAPermission('CallScript')")
    @Transactional
    open fun rpc(
        @JsonRpcParam("scriptName") scriptName: String,
        @JsonRpcParam("arguments") arguments: Map<String, Any?>,
    ): Any? {
        logger().debug("{} called for script {}", CALL_SCRIPT_OPERATION, scriptName)

        try {
            val result = callableScriptService.callScript(scriptName, arguments)
            logger().debug("{} is completed.", CALL_SCRIPT_OPERATION)
            return objectMapper.writeValueAsString(result)
        } catch (notFound: NotFoundException) {
            logger().debug(notFound.stackTraceToString())
            throwMissingCallableScriptRpcException(scriptName)
        } catch (failure: Exception) {
            logFailureTheReporterDidNotLog(scriptName, failure)
            throwCallableScriptExecutionRpcException(scriptName, failure)
        }
    }

    /**
     * The reporter logs the failures it wraps. Everything else this catch covers — a result that
     * could not be serialized, a context that could not be created, a vetoed execution — would
     * otherwise reach the caller without any operator log entry. Its message may quote data, so only
     * debug level carries it.
     */
    private fun logFailureTheReporterDidNotLog(scriptName: String, failure: Exception) {
        if (failure is ScriptExecutionException) return

        logger().logFailure("{} failed for script {} outside the script itself", failure, CALL_SCRIPT_OPERATION, scriptName)
    }

    private fun throwMissingCallableScriptRpcException(scriptName: String): Nothing = throw RpcExceptionSupport.createException(
        HttpStatus.NOT_FOUND
            .value(),
        SCRIPT_NOT_FOUND_EXCEPTION,
        "Could not find script with name $scriptName",
        "No script is registered under this name",
        RemoteOperationHelper.getOperationId(CallScriptOperation::class.java),
    )

    private fun throwCallableScriptExecutionRpcException(scriptName: String, failure: Exception): Nothing {
        // Any exception type reaches here, so a failure the reporter did not sanitize is sanitized now
        val sanitizedFailure = (failure as? ScriptExecutionException)?.failure
            ?: scriptFailureSanitizer.sanitizeScriptFailureWithoutSource(scriptName, failure)

        throw RpcExceptionSupport.createException(
            HttpStatus.INTERNAL_SERVER_ERROR
                .value(),
            SCRIPT_EXECUTION_EXCEPTION,
            sanitizedFailure.title,
            sanitizedFailure.description,
            RemoteOperationHelper.getOperationId(CallScriptOperation::class.java),
        )
    }
}
