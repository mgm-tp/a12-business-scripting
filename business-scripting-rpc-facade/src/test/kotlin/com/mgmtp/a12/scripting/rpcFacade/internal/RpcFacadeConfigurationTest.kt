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

import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import org.springframework.boot.LazyInitializationBeanFactoryPostProcessor
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.context.annotation.AnnotationConfigApplicationContext

private const val HOST_APPLICATION_RPC_FACADE_BEAN_NAME = "dataServicesRpcFacade"

/** Stands in for the A12 Workflows Engine's bean of that name, which is of an unrelated type. */
private class HostApplicationRpcFacade

private class RpcFacadeConfigurationTest {

    private val contextRunner = ApplicationContextRunner(::lazyContextRefusingBeanDefinitionOverriding)
        .withUserConfiguration(RpcFacadeConfiguration::class.java)
        .withBean(HOST_APPLICATION_RPC_FACADE_BEAN_NAME, HostApplicationRpcFacade::class.java)

    @Test
    fun `should register the rpc facade under a name no host application bean occupies`() {
        contextRunner.run { context ->
            context.startupFailure shouldBe null
            context.getBeanNamesForType(DataServicesRpcFacade::class.java).toList() shouldNotContain
                HOST_APPLICATION_RPC_FACADE_BEAN_NAME
        }
    }
}

/** Lazy so the configuration's collaborators need no mocks, and as strict about overriding as Spring Boot. */
private fun lazyContextRefusingBeanDefinitionOverriding(): ConfigurableApplicationContext = AnnotationConfigApplicationContext().apply {
    setAllowBeanDefinitionOverriding(false)
    addBeanFactoryPostProcessor(LazyInitializationBeanFactoryPostProcessor())
}
