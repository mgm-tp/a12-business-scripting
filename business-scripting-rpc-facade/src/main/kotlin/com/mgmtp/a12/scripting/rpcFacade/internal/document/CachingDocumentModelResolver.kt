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

package com.mgmtp.a12.scripting.rpcFacade.internal.document

import com.mgmtp.a12.dataservices.client.model.ModelsClient
import com.mgmtp.a12.kernel.md.facade.DocumentModelServiceFactory
import com.mgmtp.a12.kernel.md.model.api.IDocumentModel
import com.mgmtp.a12.kernel.md.model.api.services.IDocumentModelResolver
import org.springframework.beans.factory.annotation.Qualifier
import java.io.StringReader
import java.util.concurrent.ConcurrentHashMap

/**
 * A caching implementation of IDocumentModelResolver that loads DocumentModels
 * from DataServices via REST (ModelsClient) and caches them for reuse.
 *
 * This resolver enables DocumentV2 serialization/deserialization in non-DataServices
 * contexts (e.g., CIB 7) by providing access to DocumentModels.
 */
@Qualifier("cachingDocumentModelResolver")
class CachingDocumentModelResolver(
    private val modelsClient: ModelsClient,
) : IDocumentModelResolver {
    private val cache = ConcurrentHashMap<String, IDocumentModel>()
    private val dmSerializer = DocumentModelServiceFactory().createDocumentModelSerializer()

    override fun getDocumentModelById(documentModelId: String): IDocumentModel = cache.computeIfAbsent(documentModelId) { dmId ->
        val genericModel = modelsClient.loadModel(dmId)
        dmSerializer.deserialize(StringReader(genericModel))
    }
}
