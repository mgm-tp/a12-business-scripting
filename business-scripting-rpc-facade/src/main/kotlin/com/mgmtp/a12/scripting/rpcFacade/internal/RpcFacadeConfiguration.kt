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

package com.mgmtp.a12.scripting.rpcFacade.internal

import com.mgmtp.a12.dataservices.client.model.ModelsClient
import com.mgmtp.a12.dataservices.client.rpc.RequestBuilderFactory
import com.mgmtp.a12.dataservices.client.rpc.RpcOperationsClient
import com.mgmtp.a12.kernel.md.facade.DocumentServiceFactory
import com.mgmtp.a12.scripting.rpcFacade.internal.batch.BatchRpcExecutor
import com.mgmtp.a12.scripting.rpcFacade.internal.callable.DataServicesCallableScriptOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.document.CachingDocumentModelResolver
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentJsonSerializer
import com.mgmtp.a12.scripting.rpcFacade.internal.document.DocumentRpcOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.link.LinkRpcOperations
import com.mgmtp.a12.scripting.rpcFacade.internal.retry.RetryingRpcOperationsClient
import com.mgmtp.a12.scripting.rpcFacade.internal.retry.RpcRetryProperties
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import tools.jackson.databind.ObjectMapper

@Configuration
@EnableConfigurationProperties(RpcRetryProperties::class)
class RpcFacadeConfiguration(
    private val requestBuilderFactory: RequestBuilderFactory,
    private val objectMapper: ObjectMapper,
    private val modelsClient: ModelsClient,
) {
    @Bean
    @Primary
    fun retryingRpcClient(
        @Qualifier("createRestRpcOperationsClient") rpcOperationsClient: RpcOperationsClient,
        retryProperties: RpcRetryProperties,
    ): RpcOperationsClient = RetryingRpcOperationsClient(rpcOperationsClient, retryProperties)

    @Bean
    fun cachingDocumentModelResolver() = CachingDocumentModelResolver(modelsClient)

    @Bean
    fun documentServiceFactory() = DocumentServiceFactory(cachingDocumentModelResolver())

    @Bean
    fun documentJsonSerializer() = DocumentJsonSerializer(
        documentServiceFactory().createDocumentV2Serializer(),
        objectMapper,
    )

    @Bean
    fun batchRpcExecutor(rpcOperationsClient: RpcOperationsClient) = BatchRpcExecutor(
        rpcOperationsClient,
        requestBuilderFactory,
        documentJsonSerializer(),
        objectMapper,
    )

    @Bean
    fun documentRpcOperations(rpcOperationsClient: RpcOperationsClient) = DocumentRpcOperations(
        rpcOperationsClient,
        requestBuilderFactory,
        documentJsonSerializer(),
    )

    @Bean
    fun linkRpcOperations(rpcOperationsClient: RpcOperationsClient) = LinkRpcOperations(
        rpcOperationsClient,
        requestBuilderFactory,
        objectMapper,
        documentJsonSerializer(),
    )

    @Bean
    fun dataservicesCallableScriptOperations(retryingRpcClient: RpcOperationsClient) = DataServicesCallableScriptOperations(
        retryingRpcClient,
        requestBuilderFactory,
    )

    /** Named explicitly: host applications such as the A12 Workflows Engine register an unrelated `dataServicesRpcFacade` bean. */
    @Bean("businessScriptingDataServicesRpcFacade")
    fun dataServicesRpcFacade(
        documentJsonSerializer: DocumentJsonSerializer,
        documentRpcOperations: DocumentRpcOperations,
        linkRpcOperations: LinkRpcOperations,
        batchRpcExecutor: BatchRpcExecutor,
        callableScriptOperations: DataServicesCallableScriptOperations,
    ) = DataServicesRpcFacade(
        documentJsonSerializer,
        documentRpcOperations,
        linkRpcOperations,
        batchRpcExecutor,
        callableScriptOperations,
    )
}
