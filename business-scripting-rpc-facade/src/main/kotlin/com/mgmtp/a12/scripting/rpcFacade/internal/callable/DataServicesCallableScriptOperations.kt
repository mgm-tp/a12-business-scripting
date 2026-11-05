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

package com.mgmtp.a12.scripting.rpcFacade.internal.callable

import com.mgmtp.a12.dataservices.client.rpc.RequestBuilderFactory
import com.mgmtp.a12.dataservices.client.rpc.RpcOperationsClient
import com.mgmtp.a12.dataservices.rpc.JsonRpc2Response
import com.mgmtp.a12.scripting.rpcFacade.internal.JsonRpcRequestParams
import com.mgmtp.a12.scripting.shared.internal.constants.BusinessScriptingOperationConstants.CALL_SCRIPT_OPERATION

/**
 * RPC operations for A12 DataServices Callable Scripts.
 */
class DataServicesCallableScriptOperations(
    private val rpcClient: RpcOperationsClient,
    private val requestBuilderFactory: RequestBuilderFactory,
) {
    /**
     * Calls the script and returns the JSON-serialized output map, or null if the script returns no result.
     */
    fun tryCall(
        scriptName: String,
        arguments: Map<String, Any?>,
    ): String? {
        val response = invokeCall(scriptName, arguments, CALL_SCRIPT_OPERATION)
        if (response.error != null) {
            throw RuntimeException("$CALL_SCRIPT_OPERATION failed: ${response.error}")
        }
        return response.result?.asString()
    }

    // =========================================================================
    // Internal invoke methods
    // =========================================================================

    private fun invokeCall(
        scriptName: String,
        arguments: Map<String, Any?>,
        operationId: String,
    ): JsonRpc2Response = rpcClient
        .invoke(
            listOf(
                requestBuilderFactory
                    .newJsonRpc2RequestBuilder()
                    .addMethodCall(operationId)
                    .id(operationId)
                    .putParameter(JsonRpcRequestParams.SCRIPT_NAME, scriptName)
                    .putParameter(JsonRpcRequestParams.ARGUMENTS, arguments)
                    .build(),
            ),
        )[0]
}
