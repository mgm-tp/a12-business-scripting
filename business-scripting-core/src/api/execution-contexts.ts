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

import { ServerConnector } from '@com.mgmtp.a12.utils/utils-connector';

import {
    DataServicesRpcFacade,
    DocumentService,
    IDocumentV2Serializer,
    KernelDocumentService,
    LinkSpecVerifier,
    QueryService,
    RelationshipLinkService,
    ScriptCaller,
} from '../graaljs-compat-typings/index.js';
import { UNINITIALIZED_TEST_CONTEXT_MESSAGE } from '../internal/constants.js';

export type ExecutionContext = BackendContext | TestContext;

export type BackendContext = WorkflowContext | DataServicesContext;

export type WorkflowContext = {
	readonly dataServicesRpcFacade: DataServicesRpcFacade;
};

export type DataServicesContext = {
	readonly documentService: DocumentService;
	readonly queryService: QueryService;
	readonly documentV2Serializer: IDocumentV2Serializer;
	readonly relationshipLinkService: RelationshipLinkService;
	readonly linkSpecVerifier: LinkSpecVerifier;
	readonly kernelDocumentService: KernelDocumentService;
	readonly scriptCaller: ScriptCaller;
	readonly params: Record<string, unknown>;
};

export class TestContext {
    private _serverConnector: ServerConnector| undefined;
    private _authorizationHeader: string | undefined;

    init(serverConnector: ServerConnector, authorizationHeader: string) {
        this._serverConnector = serverConnector;
        this._authorizationHeader = authorizationHeader;
    }

    reset() {
        this._serverConnector = undefined;
        this._authorizationHeader = undefined;
    }

    serverConnector(): ServerConnector {
        if (!this._serverConnector) {
            throw new Error(UNINITIALIZED_TEST_CONTEXT_MESSAGE);
        }
        return this._serverConnector;
    }

    /** `Authorization` header value that authenticates the test framework against the target deployment. */
    authorizationHeader(): string {
        if (!this._authorizationHeader) {
            throw new Error(UNINITIALIZED_TEST_CONTEXT_MESSAGE);
        }
        return this._authorizationHeader;
    }
}

export function isWorkflowContext(ctx: ExecutionContext): ctx is WorkflowContext {
	return ctx !== undefined && 'dataServicesRpcFacade' in ctx;
}

export function isDataServicesContext(ctx: ExecutionContext): ctx is DataServicesContext {
	return ctx !== undefined && 'documentService' in ctx && 'queryService' in ctx;
}

export function isTestContext(ctx: ExecutionContext): ctx is TestContext {
	return ctx !== undefined && !isDataServicesContext(ctx) && !isWorkflowContext(ctx);
}

/**
 * Enables transparent swapping of execution logic of a script depending on its runtime context, see modules.ts.
 */
let executionContext: ExecutionContext;

if (typeof dataServicesRpcFacade !== 'undefined') {
	executionContext = <WorkflowContext>{
		dataServicesRpcFacade,
	};
} else if (
	typeof documentService !== 'undefined' &&
	typeof queryService !== 'undefined' &&
	typeof documentV2Serializer !== 'undefined' &&
	typeof relationshipLinkService !== 'undefined' &&
	typeof linkSpecVerifier !== 'undefined' &&
	typeof kernelDocumentService !== 'undefined' &&
	typeof scriptCaller !== 'undefined' &&
	typeof params !== 'undefined'
) {
	executionContext = <DataServicesContext>{
		documentService,
		queryService,
		documentV2Serializer,
		relationshipLinkService,
		linkSpecVerifier,
		kernelDocumentService,
		scriptCaller,
		params,
	};
} else {
	executionContext = new TestContext();
}

export { executionContext };