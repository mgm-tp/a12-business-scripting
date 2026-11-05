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

import { field, not, and, or } from '../api/facades/documents/filter.js';

const FIELD = '/Project/Name';
const STATUS_FIELD = '/Project/Status';
const PRIORITY_FIELD = '/Project/Priority';
const NAME_VALUE = 'A12 Business Scripting';
const ACTIVE_STATUS = 'Active';
const PENDING_STATUS = 'Pending';
const ARCHIVED_STATUS = 'Archived';

describe('field().equals', () => {
    it('returns exact_match constraint with string value', () => {
        // when
        const result = field(FIELD).equals(NAME_VALUE);

        // then
        expect(result).toEqual({ operator: 'exact_match', field: FIELD, value: NAME_VALUE });
    });

    it('returns exact_match constraint with numeric value', () => {
        // when
        const result = field(PRIORITY_FIELD).equals(1);

        // then
        expect(result).toEqual({ operator: 'exact_match', field: PRIORITY_FIELD, value: 1 });
    });
});

describe('field().between', () => {
    it('returns numeric_range constraint with from and to', () => {
        // when
        const result = field(PRIORITY_FIELD).between(1, 5);

        // then
        expect(result).toEqual({ operator: 'numeric_range', field: PRIORITY_FIELD, from: 1, to: 5 });
    });
});

describe('field().atLeast', () => {
    it('returns numeric_range constraint with only from', () => {
        // when
        const result = field(PRIORITY_FIELD).atLeast(3);

        // then
        expect(result).toEqual({ operator: 'numeric_range', field: PRIORITY_FIELD, from: 3 });
        expect(result).not.toHaveProperty('to');
    });
});

describe('field().atMost', () => {
    it('returns numeric_range constraint with only to', () => {
        // when
        const result = field(PRIORITY_FIELD).atMost(2);

        // then
        expect(result).toEqual({ operator: 'numeric_range', field: PRIORITY_FIELD, to: 2 });
        expect(result).not.toHaveProperty('from');
    });
});

describe('not', () => {
    it('returns not constraint wrapping the given operand', () => {
        // given
        const operand = field(FIELD).equals(ARCHIVED_STATUS);

        // when
        const result = not(operand);

        // then
        expect(result).toEqual({ operator: 'not', operand });
    });
});

describe('and', () => {
    it('returns and constraint with two operands', () => {
        // given
        const first = field(FIELD).equals(NAME_VALUE);
        const second = field(STATUS_FIELD).equals(ACTIVE_STATUS);

        // when
        const result = and(first, second);

        // then
        expect(result).toEqual({ operator: 'and', operands: [first, second] });
    });

    it('returns and constraint with three operands', () => {
        // given
        const first = field(FIELD).equals(NAME_VALUE);
        const second = field(STATUS_FIELD).equals(ACTIVE_STATUS);
        const third = field(PRIORITY_FIELD).between(1, 3);

        // when
        const result = and(first, second, third);

        // then
        expect(result).toEqual({ operator: 'and', operands: [first, second, third] });
    });
});

describe('or', () => {
    it('returns or constraint with two operands', () => {
        // given
        const first = field(STATUS_FIELD).equals(ACTIVE_STATUS);
        const second = field(STATUS_FIELD).equals(PENDING_STATUS);

        // when
        const result = or(first, second);

        // then
        expect(result).toEqual({ operator: 'or', operands: [first, second] });
    });

    it('returns or constraint with three operands', () => {
        // given
        const first = field(STATUS_FIELD).equals(ACTIVE_STATUS);
        const second = field(STATUS_FIELD).equals(PENDING_STATUS);
        const third = field(STATUS_FIELD).equals('Draft');

        // when
        const result = or(first, second, third);

        // then
        expect(result).toEqual({ operator: 'or', operands: [first, second, third] });
    });
});

describe('nested constraints', () => {
    it('and wrapping or produces correct nested structure', () => {
        // given
        const nameMatch = field(FIELD).equals(NAME_VALUE);
        const statusActive = field(STATUS_FIELD).equals(ACTIVE_STATUS);
        const statusPending = field(STATUS_FIELD).equals(PENDING_STATUS);

        // when
        const result = and(nameMatch, or(statusActive, statusPending));

        // then
        expect(result).toEqual({
            operator: 'and',
            operands: [
                nameMatch,
                { operator: 'or', operands: [statusActive, statusPending] },
            ],
        });
    });

    it('not wrapping and produces correct nested structure', () => {
        // given
        const first = field(STATUS_FIELD).equals(ARCHIVED_STATUS);
        const second = field(PRIORITY_FIELD).atMost(0);

        // when
        const result = not(and(first, second));

        // then
        expect(result).toEqual({
            operator: 'not',
            operand: { operator: 'and', operands: [first, second] },
        });
    });
});
