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

import { describe, it, expect } from 'vitest';

import {
	getFieldValues,
	traverseJsonLeaves,
	getDocumentPartsFromJson,
	prepareFieldsForWrite,
} from '../internal/document-utils.js';

import { mockDocumentV2, mockFieldInstanceV2, mockGroupInstanceV2, expectFieldSpecProps } from './test-helpers.js';

// Common test data
const BASE_PATH = '/Project';
const PHASE_NAME_PATH = '/Project/Phases/Name';
const TASK_TITLE_PATH = '/Project/Phases/Tasks/Title';
const SIMPLE_REPETITIONS = [1, 1];
const SIMPLE_REPETITIONS_3 = [1, 1, 1];
const FOO_BAR_PATH = '/foo/bar';
const FOO_BAR_VALUE = 'value1';
const FOO_BAZ_PATH = '/foo/baz';
const FOO_BAZ_VALUE = 'value2';
const EMPTY_GROUP_PATH = '/foo/emptyGroup';
const REPEAT_GROUP_PATH = '/foo/repeat';
const REPEAT_FIELD_PATH = '/foo/repeat/field';
const FIRST_REPEAT_VALUE = 'value3';
const SECOND_REPEAT_VALUE = 'value4';
const REPEAT_GROUP_REPETITIONS = [1, 2];
const REPEAT_REPETITIONS = [1, 2, 1];
const GROUP_PATH = '/foo/group';
const NESTED_FIELD_PATH = '/foo/group/nestedField';
const SECOND_NESTED_FIELD_PATH = '/foo/group/nestedField2';
const NESTED_FIELD_VALUE = 'nestedValue';

const testDoc = mockDocumentV2([
	mockFieldInstanceV2(FOO_BAR_PATH, FOO_BAR_VALUE, SIMPLE_REPETITIONS),
	mockFieldInstanceV2(FOO_BAZ_PATH, FOO_BAZ_VALUE, SIMPLE_REPETITIONS),
	mockGroupInstanceV2(EMPTY_GROUP_PATH, SIMPLE_REPETITIONS),
	mockGroupInstanceV2(GROUP_PATH, SIMPLE_REPETITIONS),
	mockGroupInstanceV2(REPEAT_GROUP_PATH, SIMPLE_REPETITIONS),
	mockGroupInstanceV2(REPEAT_GROUP_PATH, REPEAT_GROUP_REPETITIONS),
	mockFieldInstanceV2(REPEAT_FIELD_PATH, FIRST_REPEAT_VALUE, SIMPLE_REPETITIONS_3),
	mockFieldInstanceV2(REPEAT_FIELD_PATH, SECOND_REPEAT_VALUE, REPEAT_REPETITIONS),
	mockFieldInstanceV2(NESTED_FIELD_PATH, NESTED_FIELD_VALUE, SIMPLE_REPETITIONS),
	mockFieldInstanceV2(SECOND_NESTED_FIELD_PATH, NESTED_FIELD_VALUE, SIMPLE_REPETITIONS),
]);

describe('getFieldValues', () => {
	it.each([
		['simple field', [{ element: FOO_BAR_PATH, repetitions: SIMPLE_REPETITIONS }], FOO_BAR_VALUE],
		[
			'field in group with correct reps',
			[{ element: REPEAT_FIELD_PATH, repetitions: REPEAT_REPETITIONS }],
			SECOND_REPEAT_VALUE,
		],
		['repeat group', [{ element: REPEAT_GROUP_PATH, repetitions: REPEAT_GROUP_REPETITIONS }], SECOND_REPEAT_VALUE],
	])('returns value for %s', (_, elements, expected) => {
		expect(getFieldValues(testDoc, elements)).toBe(expected);
	});

	it.each([
		['non-existing field', [{ element: '/not/exist', repetitions: SIMPLE_REPETITIONS }]],
		['wrong repetitions', [{ element: REPEAT_FIELD_PATH, repetitions: [1, 3, 1] }]],
		['empty group', [{ element: EMPTY_GROUP_PATH }]],
	])('returns undefined for single-element %s', (_, elements) => {
		expect(getFieldValues(testDoc, elements)).toBeUndefined();
	});

	it('returns {} for empty elements array', () => {
		expect(getFieldValues(testDoc, [])).toStrictEqual({});
	});

	it('returns {} when all paths are absent in multi-element read', () => {
		expect(getFieldValues(testDoc, [{ element: '/not/exist' }, { element: '/also/not/exist' }])).toStrictEqual({});
	});

	it.each([
		['undefined', undefined, null],
		['null', null, null],
	])('returns %s value for field with %s value', (_, value, expected) => {
		const doc = mockDocumentV2([mockFieldInstanceV2('/test/field', value, SIMPLE_REPETITIONS)]);
		expect(getFieldValues(doc, [{ element: '/test/field' }])).toBe(expected);
	});

	it('returns map when multiple fields requested', () => {
		const result = getFieldValues(testDoc, [{ element: FOO_BAR_PATH }, { element: FOO_BAZ_PATH }]);
		expect(result).toStrictEqual({ [FOO_BAR_PATH]: FOO_BAR_VALUE, [FOO_BAZ_PATH]: FOO_BAZ_VALUE });
	});

	it('returns map when multiple fields with repetitions requested', () => {
		const result = getFieldValues(testDoc, [
			{ element: FOO_BAR_PATH },
			{ element: REPEAT_FIELD_PATH, repetitions: REPEAT_REPETITIONS },
		]);
		expect(result).toStrictEqual({ [FOO_BAR_PATH]: FOO_BAR_VALUE, [REPEAT_FIELD_PATH]: SECOND_REPEAT_VALUE });
	});

	it('returns map (not single value) when multiple fields requested but only one found', () => {
		const result = getFieldValues(testDoc, [{ element: '/not/exist' }, { element: FOO_BAZ_PATH }]);
		expect(result).toStrictEqual({ [FOO_BAZ_PATH]: FOO_BAZ_VALUE });
	});

	it('returns all nested fields when group path requested', () => {
		const result = getFieldValues(testDoc, [{ element: GROUP_PATH }]);
		expect(result).toStrictEqual({
			[NESTED_FIELD_PATH]: NESTED_FIELD_VALUE,
			[SECOND_NESTED_FIELD_PATH]: NESTED_FIELD_VALUE,
		});
	});
});

describe('traverseJsonLeaves', () => {
	it('calls onLeaf for each leaf in flat object', () => {
		const json = { a: 1, b: 'two' };
		const results = traverseJsonLeaves(json, (path, value, reps) => ({ path, value, reps }));

		expect(results).toHaveLength(2);
		expect(results).toContainEqual({ path: '/a', value: 1, reps: [1] });
		expect(results).toContainEqual({ path: '/b', value: 'two', reps: [1] });
	});

	it('builds correct paths for nested objects', () => {
		const json = { outer: { inner: 'value' } };
		const results = traverseJsonLeaves(json, (path, value, reps) => ({ path, value, reps }));

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({ path: '/outer/inner', value: 'value', reps: [1, 1] });
	});

	it('handles arrays with 1-based repetition indices', () => {
		const json = { items: [{ name: 'first' }, { name: 'second' }] };
		const results = traverseJsonLeaves(json, (path, value, reps) => ({ path, value, reps }));

		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({ path: '/items/name', value: 'first', reps: [1, 1] });
		expect(results[1]).toEqual({ path: '/items/name', value: 'second', reps: [2, 1] });
	});

	it('returns empty array for empty object', () => {
		expect(traverseJsonLeaves({}, (v) => v)).toEqual([]);
	});

	it('handles null and undefined leaf values', () => {
		const json = { nullVal: null, undefVal: undefined };
		const results = traverseJsonLeaves(json, (path, value) => ({ path, value }));

		expect(results).toContainEqual({ path: '/nullVal', value: null });
		expect(results).toContainEqual({ path: '/undefVal', value: undefined });
	});

	it('handles deeply nested structure', () => {
		const json = { a: { b: { c: { d: 'deep' } } } };
		const results = traverseJsonLeaves(json, (path, value, reps) => ({ path, reps }));

		expect(results[0]).toEqual({ path: '/a/b/c/d', reps: [1, 1, 1, 1] });
	});
});

describe('getDocumentPartsFromJson', () => {
	it('creates DocumentParts with basePath prefix', () => {
		const json = { Name: 'Test', Status: 'Active' };
		const parts = getDocumentPartsFromJson(json, BASE_PATH);

		expect(parts).toHaveLength(2);
		expect(parts).toContainEqual({ path: `${BASE_PATH}/Name`, value: 'Test', repetitions: SIMPLE_REPETITIONS });
		expect(parts).toContainEqual({ path: `${BASE_PATH}/Status`, value: 'Active', repetitions: SIMPLE_REPETITIONS });
	});

	it('handles nested objects correctly', () => {
		const json = { Details: { StartDate: '2024-01-01', Owner: 'Max' } };
		const parts = getDocumentPartsFromJson(json, BASE_PATH);

		expect(parts).toHaveLength(2);
		expect(parts).toContainEqual({ path: `${BASE_PATH}/Details/StartDate`, value: '2024-01-01', repetitions: SIMPLE_REPETITIONS_3 });
		expect(parts).toContainEqual({ path: `${BASE_PATH}/Details/Owner`, value: 'Max', repetitions: SIMPLE_REPETITIONS_3 });
	});

	it('handles arrays with correct repetitions', () => {
		const json = { Tasks: [{ Name: 'Task A' }, { Name: 'Task B' }] };
		const parts = getDocumentPartsFromJson(json, BASE_PATH);

		expect(parts).toHaveLength(2);
		expect(parts[0]).toEqual({ path: `${BASE_PATH}/Tasks/Name`, value: 'Task A', repetitions: SIMPLE_REPETITIONS_3 });
		expect(parts[1]).toEqual({ path: `${BASE_PATH}/Tasks/Name`, value: 'Task B', repetitions: [1, 2, 1] });
	});

	it('returns empty array for empty input', () => {
		expect(getDocumentPartsFromJson({}, BASE_PATH)).toEqual([]);
	});

	it('creates default repetitions based on full path depth', () => {
		const json = { a: { b: { c: 'value' } } };
		const parts = getDocumentPartsFromJson(json, '/root');

		expect(parts[0].repetitions).toEqual([1, 1, 1, 1]);
	});

	it('handles mixed nested arrays and objects', () => {
		const json = {
			Phases: [
				{ Name: 'Phase 1', Tasks: [{ Title: 'T1' }] },
				{ Name: 'Phase 2', Tasks: [{ Title: 'T2' }, { Title: 'T3' }] },
			],
		};
		const parts = getDocumentPartsFromJson(json, BASE_PATH);

		const phaseNames = parts.filter((p) => p.path === PHASE_NAME_PATH);
		expect(phaseNames).toHaveLength(2);
		expect(phaseNames[0]).toEqual({ path: PHASE_NAME_PATH, value: 'Phase 1', repetitions: SIMPLE_REPETITIONS_3 });
		expect(phaseNames[1]).toEqual({ path: PHASE_NAME_PATH, value: 'Phase 2', repetitions: [1, 2, 1] });

		const taskTitles = parts.filter((p) => p.path === TASK_TITLE_PATH);
		expect(taskTitles).toHaveLength(3);
		expect(taskTitles[0]).toEqual({ path: TASK_TITLE_PATH, value: 'T1', repetitions: [1, 1, 1, 1] });
		expect(taskTitles[1]).toEqual({ path: TASK_TITLE_PATH, value: 'T2', repetitions: [1, 2, 1, 1] });
		expect(taskTitles[2]).toEqual({ path: TASK_TITLE_PATH, value: 'T3', repetitions: [1, 2, 2, 1] });
	});
});

describe('prepareFieldsForWrite', () => {
	const GROUP_FIELD_PATH = '/group/field';
	const GROUP_SIBLING_PATH = '/group/sibling';
	const GROUP_PATH = '/group';
	const OTHER_GROUP_FIELD_PATH = '/otherGroup/field';
	const OTHER_GROUP_PATH = '/otherGroup';
	const ROOT_FIELD_PATH = '/rootField';
	const FIELD_VALUE_A = 'valueA';
	const FIELD_VALUE_B = 'valueB';

	const docWithOneGroupRep = mockDocumentV2([mockGroupInstanceV2(GROUP_PATH, [1])]);
	const docWithTwoGroupReps = mockDocumentV2([
		mockGroupInstanceV2(GROUP_PATH, [1]),
		mockGroupInstanceV2(GROUP_PATH, [2]),
	]);
	const docWithTwoGroups = mockDocumentV2([
		mockGroupInstanceV2(GROUP_PATH, [1]),
		mockGroupInstanceV2(OTHER_GROUP_PATH, [1]),
	]);

	it('assigns sequential repetitions for multiple appends of the same field path', () => {
		// given
		const fields = [
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_B, append: true },
		];

		// when
		const result = prepareFieldsForWrite(fields, docWithOneGroupRep);

		// then
		expect(result).toHaveLength(2);
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [2, 1]);
		expectFieldSpecProps(result[1]!, GROUP_FIELD_PATH, FIELD_VALUE_B, [3, 1]);
	});

	it('assigns separate sequential repetitions for different fields targeting the same group', () => {
		// given: two different sibling fields, each with append:true — both target the same group, so they increment the same counter
		const fields = [
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
			{ path: GROUP_SIBLING_PATH, value: FIELD_VALUE_B, append: true },
		];

		// when
		const result = prepareFieldsForWrite(fields, docWithOneGroupRep);

		// then: each entry gets its own distinct new repetition
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [2, 1]);
		expectFieldSpecProps(result[1]!, GROUP_SIBLING_PATH, FIELD_VALUE_B, [3, 1]);
	});

	it('assigns correct repetition for a single append', () => {
		// given / when
		const result = prepareFieldsForWrite(
			[{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true }],
			docWithOneGroupRep,
		);

		// then
		expect(result).toHaveLength(1);
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [2, 1]);
	});

	it('seeds the counter from the document max repetition', () => {
		// given
		const fields = [
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_B, append: true },
		];

		// when
		const result = prepareFieldsForWrite(fields, docWithTwoGroupReps);

		// then: doc has max rep 2, so first append is 3, second is 4
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [3, 1]);
		expectFieldSpecProps(result[1]!, GROUP_FIELD_PATH, FIELD_VALUE_B, [4, 1]);
	});

	it('tracks counters per group independently for different groups', () => {
		// given
		const fields = [
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
			{ path: OTHER_GROUP_FIELD_PATH, value: FIELD_VALUE_B, append: true },
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
		];

		// when
		const result = prepareFieldsForWrite(fields, docWithTwoGroups);

		// then: each group has its own counter; second /group append increments /group counter
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [2, 1]);
		expectFieldSpecProps(result[1]!, OTHER_GROUP_FIELD_PATH, FIELD_VALUE_B, [2, 1]);
		expectFieldSpecProps(result[2]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [3, 1]);
	});

	it('supports FieldInput format (field property instead of path)', () => {
		// given
		const fields = [
			{ field: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
			{ field: GROUP_FIELD_PATH, value: FIELD_VALUE_B, append: true },
		];

		// when
		const result = prepareFieldsForWrite(fields, docWithOneGroupRep);

		// then
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [2, 1]);
		expectFieldSpecProps(result[1]!, GROUP_FIELD_PATH, FIELD_VALUE_B, [3, 1]);
	});

	it('passes through repetitions unchanged when append is false', () => {
		// given / when
		const result = prepareFieldsForWrite([{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, repetitions: [5, 1] }]);

		// then
		expect(result).toHaveLength(1);
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [5, 1]);
	});

	it('ignores append flag when no document is provided', () => {
		// given / when
		const result = prepareFieldsForWrite([{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true }]);

		// then
		expect(result).toHaveLength(1);
		expect(result[0]!.path).toBe(GROUP_FIELD_PATH);
		expect(result[0]!.value).toBe(FIELD_VALUE_A);
		expect(result[0]!.repetitions).toBeUndefined();
	});

	it('returns [1] for a root-level field path with append', () => {
		// given
		const docWithRootField = mockDocumentV2([]);

		// when
		const result = prepareFieldsForWrite([{ path: ROOT_FIELD_PATH, value: FIELD_VALUE_A, append: true }], docWithRootField);

		// then
		expectFieldSpecProps(result[0]!, ROOT_FIELD_PATH, FIELD_VALUE_A, [1]);
	});

	it('assigns correct repetitions for nested-group append', () => {
		// given: path with three levels (/outer/inner/field), doc has one inner-group rep
		const OUTER_INNER_FIELD_PATH = '/outer/inner/field';
		const INNER_GROUP_PATH = '/outer/inner';
		const docWithNestedGroup = mockDocumentV2([mockGroupInstanceV2(INNER_GROUP_PATH, [1, 1])]);

		// when
		const result = prepareFieldsForWrite(
			[
				{ path: OUTER_INNER_FIELD_PATH, value: FIELD_VALUE_A, append: true },
				{ path: OUTER_INNER_FIELD_PATH, value: FIELD_VALUE_B, append: true },
			],
			docWithNestedGroup,
		);

		// then: outer level stays 1, inner group index increments
		expectFieldSpecProps(result[0]!, OUTER_INNER_FIELD_PATH, FIELD_VALUE_A, [1, 2, 1]);
		expectFieldSpecProps(result[1]!, OUTER_INNER_FIELD_PATH, FIELD_VALUE_B, [1, 3, 1]);
	});

	it('counts empty group repetitions (no fields) toward the append index', () => {
		// given: group /A has two repetitions but no fields — structural presence must count
		const docWithEmptyReps = mockDocumentV2([
			mockGroupInstanceV2(GROUP_PATH, [1]),
			mockGroupInstanceV2(GROUP_PATH, [2]),
		]);

		// when
		const result = prepareFieldsForWrite(
			[{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true }],
			docWithEmptyReps,
		);

		// then: next append is rep 3, not 1
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [3, 1]);
	});

	it('does not perturb the append counter when a non-append field appears between two appends', () => {
		// given
		const fields = [
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
			{ path: GROUP_SIBLING_PATH, value: FIELD_VALUE_B, repetitions: [99, 1] },
			{ path: GROUP_FIELD_PATH, value: FIELD_VALUE_A, append: true },
		];

		// when
		const result = prepareFieldsForWrite(fields, docWithOneGroupRep);

		// then: explicit-repetitions entry is unchanged; second append still gets the next row
		expectFieldSpecProps(result[0]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [2, 1]);
		expectFieldSpecProps(result[1]!, GROUP_SIBLING_PATH, FIELD_VALUE_B, [99, 1]);
		expectFieldSpecProps(result[2]!, GROUP_FIELD_PATH, FIELD_VALUE_A, [3, 1]);
	});
});
