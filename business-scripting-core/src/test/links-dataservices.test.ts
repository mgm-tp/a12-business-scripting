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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { DocumentReference } from '../api/document-reference.js';
import { mockDocumentV2, mockFieldInstanceV2, mockJavaThrowable } from '../internal/mock-helpers.js';
import { create, remove } from '../api/facades/links.js';
import { LinkSpecIncompleteError, LinkSpecMismatchError, ScriptingError } from '../api/errors.js';

const RM_NAME = 'Project_Employee_RM';
const SOURCE_ROLE = 'Project';
const TARGET_ROLE = 'Employee';
const LINK_ID = 'link-1';
const SERIALIZED_DOCUMENT_JSON = '{"Assignment":{"Allocation":50}}';

const projectDocRef = new DocumentReference('Project_DM', '1');
const employeeDocRef = new DocumentReference('Employee_DM', '1');

const linkDescriptor = {
	relationshipModelName: RM_NAME,
	sourceRole: SOURCE_ROLE,
	sourceDocRef: projectDocRef,
	targetRole: TARGET_ROLE,
	targetDocRef: employeeDocRef,
};

/**
 * Stand-ins for the Java classes the DataServices branch constructs, so the test can assert that the
 * descriptor handed to RelationshipLinkService was built by calling their constructors.
 */
const { JavaDocumentReference, JavaRelationshipRoleSpec, JavaLinkDescriptor } = vi.hoisted(() => {
	class JavaDocumentReference {
		constructor(readonly docRef: string) {}
		toString() {
			return this.docRef;
		}
	}
	class JavaRelationshipRoleSpec {
		constructor(
			readonly role: string,
			readonly docRef: JavaDocumentReference,
		) {}
	}
	class JavaLinkDescriptor {
		constructor(
			readonly relationshipModel: string,
			readonly entities: JavaRelationshipRoleSpec[],
		) {}
	}
	return { JavaDocumentReference, JavaRelationshipRoleSpec, JavaLinkDescriptor };
});

const expectedDsLinkDescriptor = new JavaLinkDescriptor(RM_NAME, [
	new JavaRelationshipRoleSpec(SOURCE_ROLE, new JavaDocumentReference(projectDocRef.toString())),
	new JavaRelationshipRoleSpec(TARGET_ROLE, new JavaDocumentReference(employeeDocRef.toString())),
]);

function expectCalledWithJavaLinkDescriptor(createSpy: Mock, ...furtherArguments: unknown[]) {
	expect(createSpy).toHaveBeenCalledWith(expectedDsLinkDescriptor, ...furtherArguments);
	expect(createSpy.mock.calls[0]![0]).toBeInstanceOf(JavaLinkDescriptor);
}

const createWithLinkDocumentSpy = vi.hoisted(() => vi.fn());
const createWithoutLinkDocumentSpy = vi.hoisted(() => vi.fn());
const serializeV2Spy = vi.hoisted(() => vi.fn());
const deleteLinkSpy = vi.hoisted(() => vi.fn());
const verifyLinkSpecSpy = vi.hoisted(() => vi.fn());
const { mockGraalJsBarrelWithJavaClasses } = await vi.hoisted(() => import('./graaljs-barrel-mock.js'));

vi.mock('../api/execution-contexts.js', () => ({
	executionContext: {
		relationshipLinkService: {
			'create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor,java.lang.String)':
				createWithLinkDocumentSpy,
			'create(com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor)': createWithoutLinkDocumentSpy,
			'delete(java.lang.String)': deleteLinkSpy,
		},
		linkSpecVerifier: { verifyLinkSpecIsCompleteAndMatchesStoredLink: verifyLinkSpecSpy },
		documentV2Serializer: {
			'serializeV2(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.io.Writer,com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig)':
				serializeV2Spy,
		},
	},
	isDataServicesContext: () => true,
	isWorkflowContext: () => false,
	isTestContext: () => false,
}));

vi.mock('../graaljs-compat-typings/index.js', mockGraalJsBarrelWithJavaClasses({
	'com.mgmtp.a12.dataservices.relationship.spec.LinkDescriptor': JavaLinkDescriptor,
	'com.mgmtp.a12.dataservices.relationship.spec.RelationshipRoleSpec': JavaRelationshipRoleSpec,
	'com.mgmtp.a12.dataservices.document.DocumentReference': JavaDocumentReference,
	'java.io.StringWriter': class StringWriter {
		content = '';
		toString() {
			return this.content;
		}
	},
	'com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig': {
		builder: () => ({ format: () => ({ build: () => ({}) }) }),
		Format: { JSON: 'JSON' },
	},
}));

describe('Links.create in DataServicesContext', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createWithLinkDocumentSpy.mockReturnValue({ getId: () => LINK_ID });
		createWithoutLinkDocumentSpy.mockReturnValue({ getId: () => LINK_ID });
	});

	it('should pass a plain object link document as JSON string to RelationshipLinkService', async () => {
		// given
		const linkDocument = { Assignment: { Allocation: 50 } };

		// when
		const result = await create(linkDescriptor, linkDocument);

		// then
		expectCalledWithJavaLinkDescriptor(createWithLinkDocumentSpy, SERIALIZED_DOCUMENT_JSON);
		expect(result).toBe(LINK_ID);
	});

	it('should serialize a DocumentV2 link document via the document serializer', async () => {
		// given
		const linkDocument = mockDocumentV2(
			[mockFieldInstanceV2('/Assignment/Allocation', 50, [1, 1])],
			'Assignment_DM',
		);
		serializeV2Spy.mockImplementation((_document, writer: { content: string }) => {
			writer.content = SERIALIZED_DOCUMENT_JSON;
		});

		// when
		const result = await create(linkDescriptor, linkDocument);

		// then
		expect(serializeV2Spy).toHaveBeenCalledOnce();
		expectCalledWithJavaLinkDescriptor(createWithLinkDocumentSpy, SERIALIZED_DOCUMENT_JSON);
		expect(result).toBe(LINK_ID);
	});

	it('should create without link document when none is provided', async () => {
		// when
		const result = await create(linkDescriptor);

		// then
		expectCalledWithJavaLinkDescriptor(createWithoutLinkDocumentSpy);
		expect(createWithLinkDocumentSpy).not.toHaveBeenCalled();
		expect(result).toBe(LINK_ID);
	});
});

const DATA_ACCESS_EXCEPTION = 'org.springframework.dao.DataAccessResourceFailureException';
const CONNECTION_LOST_MESSAGE = 'Connection to the database was lost';
const RELATIONSHIP_EXCEPTION_PACKAGE = 'com.mgmtp.a12.dataservices.relationship.exception';
const OTHER_LINK_ID = 'link-2';

describe('Links.remove in DataServicesContext', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyLinkSpecSpy.mockReset();
	});

	it('should verify each spec against its stored link before deleting any link', async () => {
		// when
		await remove([{ id: LINK_ID, linkDescriptor }, { id: OTHER_LINK_ID, linkDescriptor }]);

		// then
		expect(verifyLinkSpecSpy).toHaveBeenNthCalledWith(1, LINK_ID, expectedDsLinkDescriptor);
		expect(verifyLinkSpecSpy).toHaveBeenNthCalledWith(2, OTHER_LINK_ID, expectedDsLinkDescriptor);
		expect(verifyLinkSpecSpy.mock.calls[0]![1]).toBeInstanceOf(JavaLinkDescriptor);
		expect(deleteLinkSpy.mock.invocationCallOrder[0]).toBeGreaterThan(verifyLinkSpecSpy.mock.invocationCallOrder[1]!);
		expect(deleteLinkSpy).toHaveBeenNthCalledWith(1, LINK_ID);
		expect(deleteLinkSpy).toHaveBeenNthCalledWith(2, OTHER_LINK_ID);
	});

	it('should reject an incomplete spec and delete nothing', async () => {
		// given
		verifyLinkSpecSpy.mockImplementation(() => {
			throw mockJavaThrowable(`${RELATIONSHIP_EXCEPTION_PACKAGE}.RelationshipLinkEntityInvalidException`, 'Role is not valid.');
		});

		// when / then
		await expect(remove({ id: LINK_ID, linkDescriptor })).rejects.toBeInstanceOf(LinkSpecIncompleteError);
		expect(deleteLinkSpy).not.toHaveBeenCalled();
	});

	it('should reject a list whose last spec does not match its stored link and delete nothing', async () => {
		// given
		verifyLinkSpecSpy
			.mockImplementationOnce(() => undefined)
			.mockImplementationOnce(() => {
				throw mockJavaThrowable(`${RELATIONSHIP_EXCEPTION_PACKAGE}.RelationshipRoleMismatchException`, 'Validation of links failed.');
			});

		// when / then
		await expect(remove([{ id: OTHER_LINK_ID, linkDescriptor }, { id: LINK_ID, linkDescriptor }]))
			.rejects.toBeInstanceOf(LinkSpecMismatchError);
		expect(deleteLinkSpy).not.toHaveBeenCalled();
	});

	it('should reject when verifying fails for another reason and delete nothing', async () => {
		// given
		verifyLinkSpecSpy.mockImplementation(() => {
			throw mockJavaThrowable(DATA_ACCESS_EXCEPTION, CONNECTION_LOST_MESSAGE);
		});

		// when / then
		await expect(remove({ id: LINK_ID, linkDescriptor })).rejects.toBeInstanceOf(ScriptingError);
		expect(deleteLinkSpy).not.toHaveBeenCalled();
	});
});
