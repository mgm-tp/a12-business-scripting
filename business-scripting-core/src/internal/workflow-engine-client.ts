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

import {DocumentReference} from '../api/document-reference.js';

import { throwIfCredentialRejected } from './credential-rejection.js';

function buildBpmnTemplate(scriptName: string): string { return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="${scriptName}" isExecutable="true" camunda:historyTimeToLive="365">
    <startEvent id="start"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task"/>
    <serviceTask id="task" name="Script Delegate" camunda:delegateExpression="\${${scriptName}}"/>
    <sequenceFlow id="flow2" sourceRef="task" targetRef="end"/>
    <endEvent id="end"/>
  </process>
</definitions>`; }

type ProcessEngineVariableType = 'String' | 'Boolean' | 'Integer' | 'Double' | 'Json';

interface ProcessEngineVariable {
    value: unknown;
    type: ProcessEngineVariableType;
}

// Supported types: string, number, boolean, DocumentReference (as string), arrays and objects (as JSON string).
// Custom object types are not supported by ScriptInvoker and will not work here either.
export function toProcessEngineVariable(value: unknown): ProcessEngineVariable {
    if (value === null || value === undefined) {
        throw new Error(`toProcessEngineVariable: unsupported value: ${value}`);
    }
    if (typeof value === 'string') {return { value, type: 'String' };}
    if (typeof value === 'boolean') {return { value, type: 'Boolean' };}
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { value, type: 'Integer' }
            : { value, type: 'Double' };
    }
    if (value instanceof DocumentReference) {return { value: value.toString(), type: 'String' };}
    return { value: JSON.stringify(value), type: 'String' };
}

export class WorkflowEngineClient {
    constructor(private readonly baseUrl: string, private readonly authorizationHeader: string) {}

    async deployScriptDelegateProcess(processDefinitionKey: string): Promise<void> {
        const bpmnXml = buildBpmnTemplate(processDefinitionKey);
        const form = new FormData();
        form.append('deployment-name', processDefinitionKey);
        form.append('data', new Blob([bpmnXml], { type: 'application/octet-stream' }), `${processDefinitionKey}.bpmn`);

        // No Content-Type: fetch derives it from the FormData body, including the multipart boundary.
        const response = await fetch(`${this.baseUrl}/deployment/create`, {
            method: 'POST',
            headers: { Authorization: this.authorizationHeader },
            body: form,
        });
        if (!response.ok) {
            throwIfCredentialRejected(response.status);
            throw new Error(`BPMN deployment failed: ${response.status} ${await response.text()}`);
        }
    }

    async startProcessInstance(processDefinitionKey: string, businessKey: string, variables: Record<string, unknown>): Promise<string> {
        const body = {
            businessKey,
            variables: Object.fromEntries(
                Object.entries(variables).map(([key, value]) => [key, toProcessEngineVariable(value)])
            ),
        };
        const response = await fetch(`${this.baseUrl}/process-definition/key/${processDefinitionKey}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: this.authorizationHeader },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throwIfCredentialRejected(response.status);
            throw new Error(`Start process failed: ${response.status} ${await response.text()}`);
        }
        const { id } = await response.json() as { id: string };
        return id;
    }

    async getHistoricVariables(processInstanceId: string): Promise<Record<string, unknown>> {
        const url = `${this.baseUrl}/history/variable-instance?processInstanceId=${processInstanceId}`;
        const response = await fetch(url, { headers: { Authorization: this.authorizationHeader } });
        if (!response.ok) {
            throwIfCredentialRejected(response.status);
            throw new Error(`Get historic variables failed: ${response.status} ${await response.text()}`);
        }
        const array = await response.json() as Array<{ name: string; value: unknown }>;
        return Object.fromEntries(array.map(entry => [entry.name, entry.value]));
    }
}
