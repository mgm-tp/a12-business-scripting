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

package com.mgmtp.a12.scripting.shared.debugging.extension.config

import com.mgmtp.a12.scripting.shared.internal.functions.logger
import jakarta.annotation.PostConstruct
import org.graalvm.polyglot.Engine
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean

@AutoConfiguration
@EnableConfigurationProperties(ScriptDebugProperties::class)
class GraalJsEngineAutoConfiguration(private val properties: ScriptDebugProperties) {

    @PostConstruct
    fun warnIfDebugEnabled() {
        if (!properties.enabled) return
        logger().warn(
            "GraalJS Chrome DevTools debugging is ENABLED on {}. Anyone who can connect to the inspector can run arbitrary code in this service. Do NOT use in production!",
            properties.port,
        )
    }

    /** Shared GraalJS engine with debug options applied. All contexts should use this engine. */
    @Bean
    fun graalJsEngine(): Engine {
        val builder = Engine
            .newBuilder("js", "ts")
            .allowExperimentalOptions(true)
        properties
            .graalEngineOptions()
            .forEach { (k, v) -> builder.option(k, v) }
        return builder.build()
    }
}
