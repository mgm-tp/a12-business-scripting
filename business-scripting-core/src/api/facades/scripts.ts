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

import {mapDsError} from '../../internal/ds-error-mapper.js';
import {scriptExecutionError} from '../../internal/error-builders.js';
import {mapRpcError} from '../../internal/rpc-error-mapper.js';
import {callRpc} from "../../internal/rpc.js";
import {WorkflowEngineClient} from "../../internal/workflow-engine-client.js";
import {
    isBeanSerializedDocumentReference,
    isJavaDocumentReference,
    isJavaList,
    javaListToArray,
} from '../../graaljs-compat-typings/index.js';

import {DocumentReference, isDocumentReferenceString} from "../document-reference.js";
import {
    ExecutionContext,
    executionContext,
    isDataServicesContext,
    isTestContext,
    isWorkflowContext,
} from '../execution-contexts.js';
import {
    BusinessScriptingVetoError,
    ScriptExecutionError,
    ScriptingError,
    ScriptNotFoundError,
    UnsupportedContextError,
} from '../errors.js';

import * as Log from './logging.js';

/** @internal */
export const WORKFLOWS_URL_ENV_VAR = 'A12_SCRIPTING_TESTING_WORKFLOWS_URL';

// Survives for the lifetime of the test process. If Workflow Engine restarts mid-run, this cache
// goes stale and subsequent calls will fail with "process definition not found".
const deployedProcesses = new Set<string>();

/** @internal */
export function clearDeployedProcessesForTesting(): void {
    deployedProcesses.clear();
}

export type ScriptCallTargetContext = 'dataServices' | 'workflows';

export interface ScriptOptions {
    targetContext: ScriptCallTargetContext;
}

function getConnector() {
    if (!isTestContext(executionContext) || !executionContext.serverConnector) {
        throw new Error('No serverConnector configured for HTTP operations');
    }
    return executionContext.serverConnector();
}

/**
 * Calls an existing Script.
 * @param scriptName - The name of the script to call.
 * @param args - The arguments to call the script with.
 * @param options - Allow to configure the scripts call environment.
 *
 * @example
 * ```ts
 * const result = await A12.Scripts.call<OutputType>('createInvoice', { orderRef });
 * ```
 */

export async function call<T>(scriptName: string, args: Record<string, unknown>, options: ScriptOptions | undefined = undefined): Promise<T> {
    const operationName = "Scripts.call"
    validateScriptOptionsOrThrow(executionContext, options)

    let result;
    if (isDataServicesContext(executionContext)) {
        Log.info('Running in Data Services context...');
        try {
            const raw = executionContext.scriptCaller.callScript(scriptName, new Map(Object.entries(args)));
            result = Object.fromEntries(raw.entries())
        } catch (error) {
            const mapped = mapDsError(error, {operationName, scriptName});
            throwMappedScriptError(scriptName, mapped, error);
        }
    } else if (isWorkflowContext(executionContext)) {
        Log.info('Running in engine task context...');
        try {
            const raw = executionContext.dataServicesRpcFacade.tryCallScript(scriptName, new Map(Object.entries(args)));
            // The CALL_SCRIPT RPC returns the script result map as a JSON string.
            result = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (error) {
            const mapped = mapRpcError(error, {operationName, scriptName});
            throwMappedScriptError(scriptName, mapped, error);
        }
    } else if (isTestContext(executionContext)) {
        const targetContext = options!.targetContext

        if (!['dataServices', 'workflows'].includes(targetContext)) {
            throw new Error(`A12.Scripts.call: unsupported target context "${targetContext} in TestContext"`);
        }

        if (targetContext === 'workflows') {
            const wfEngineBaseUrl = process.env[WORKFLOWS_URL_ENV_VAR];
            if (!wfEngineBaseUrl) {
                throw new Error(`A12.Scripts.call: ${WORKFLOWS_URL_ENV_VAR} environment variable is not set`);
            }
            const client = new WorkflowEngineClient(wfEngineBaseUrl, executionContext.authorizationHeader());
            const businessKey = crypto.randomUUID();

            if (!deployedProcesses.has(scriptName)) {
                Log.info(`Deploying BPMN process for script '${scriptName}'...`);
                await client.deployScriptDelegateProcess(scriptName);
                deployedProcesses.add(scriptName);
            }

            const processInstanceId = await client.startProcessInstance(scriptName, businessKey, args);
            const allVariables = await client.getHistoricVariables(processInstanceId);
            const inputKeys = new Set(Object.keys(args));
            result = Object.fromEntries(Object.entries(allVariables).filter(([k]) => !inputKeys.has(k))) ;

        } else if (targetContext === 'dataServices') {
            result = await callRpc(getConnector(), 'CALL_SCRIPT', {
                scriptName,
                arguments: args,
            })

        }
    } else {
        throw new UnsupportedContextError(operationName);
    }

    if (result && typeof result === 'object') {
        result = Object.fromEntries(
            Object.entries(result).map(([key, value]) => [key, parseIfDocRef(value)])
        );
    }
    return result as T;
}

/**
 * Parses a value into a DocumentReference if it matches one of the three shapes a script result
 * carries a document reference in:
 * - a "documentModelName/documentId" string that satisfies the DocumentReference rules — how A12
 *   2026.06 serializes a DocumentReference to JSON, used by the Data Services call paths. A script
 *   output string that breaks those rules is an ordinary string and stays one.
 * - a Java DocumentReference host object — the Data Services context passes results through
 *   without serializing them
 * - a {documentModelName, documentId} object — the workflow engine serializes a docRef process
 *   variable with its own mapper, which does not apply the A12 DocumentReference serializer
 * Lists arrive as a JS array on the serializing paths and as a Java list in the Data Services
 * context; both are unwrapped element by element.
 * Root cause: De-/Serialization of DocumentReference in DataServices disables
 * automatic conversion to the TS DocumentReference type.
 * Remaining gap: Can't distinguish if "abc/123" is a DocumentReference or a string and
 * will always choose to cast to DocumentReference.
 * @param value
 */
function parseIfDocRef(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(parseIfDocRef);
    }
    if (isJavaList(value)) {
        return javaListToArray(value).map(parseIfDocRef);
    }
    if (isJavaDocumentReference(value)) {
        return new DocumentReference(String(value.getDocumentModelName()), String(value.getDocumentId()));
    }
    if (isBeanSerializedDocumentReference(value)) {
        return new DocumentReference(value.documentModelName, value.documentId);
    }
    if (typeof value === 'string' && isDocumentReferenceString(value)) {
        return DocumentReference.fromString(value);
    }
    return value;
}

function throwMappedScriptError(scriptName: string, mapped: ScriptingError, error: unknown): never {
    if (mapped instanceof ScriptNotFoundError || mapped instanceof ScriptExecutionError || mapped instanceof BusinessScriptingVetoError) {
        throw mapped;
    }
    throw scriptExecutionError(`Script '${scriptName}' failed`, error, mapped.message);
}

function validateScriptOptionsOrThrow(executionContext: ExecutionContext , options: ScriptOptions | undefined) {
    if (isTestContext(executionContext) && !options?.targetContext){
        throw new ScriptingError("[A12.Scripts.call] TestContext requires options.targetContext to be set!")
    }
    if ((isWorkflowContext(executionContext)|| isDataServicesContext(executionContext)) && options?.targetContext){
        throw new ScriptingError(`[A12.Scripts.call] The option targetContext is not allowed in ${executionContext}!`)
    }
}
