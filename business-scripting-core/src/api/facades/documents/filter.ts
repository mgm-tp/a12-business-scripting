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

/**
 * Filter helpers for Documents.find(). Start with `field(path)` to build a predicate and
 * combine multiple with `and` / `or` / `not`.
 *
 * Field paths use slash-prefixed notation (e.g. "/Project/Name").
 *
 * @see Constraint
 */

import { Constraint } from '../../types.js';

/**
 * Starts a filter expression for a specific field.
 *
 * @example
 * ```ts
 * A12.Documents.Filter.field("/Project/Name").equals("A12")
 * A12.Documents.Filter.field("/Project/Priority").between(1, 5)
 * A12.Documents.Filter.field("/Project/Priority").atLeast(3)
 * A12.Documents.Filter.field("/Project/Priority").atMost(2)
 * ```
 */
export function field(fieldPath: string): FieldFilter {
    return new FieldFilter(fieldPath);
}

/** Builder returned by `field()`. Each method produces a ready-to-use Constraint. */
export class FieldFilter {
    constructor(private readonly fieldPath: string) {}

    /** Matches documents where the field equals the given value. */
    equals(value: string | number): Constraint {
        return { operator: 'exact_match', field: this.fieldPath, value };
    }

    /** Matches documents where the field is within the numeric range [from, to]. */
    between(from: number, to: number): Constraint {
        return { operator: 'numeric_range', field: this.fieldPath, from, to };
    }

    /** Matches documents where the field is >= from. */
    atLeast(from: number): Constraint {
        return { operator: 'numeric_range', field: this.fieldPath, from };
    }

    /** Matches documents where the field is <= to. */
    atMost(to: number): Constraint {
        return { operator: 'numeric_range', field: this.fieldPath, to };
    }
}

/**
 * Negation of a constraint.
 *
 * @example
 * ```ts
 * A12.Documents.Filter.not(
 *     A12.Documents.Filter.field("/Project/Status").equals("Archived")
 * )
 * ```
 */
export function not(operand: Constraint): Constraint {
    return { operator: 'not', operand };
}

/**
 * Logical AND of two or more constraints.
 *
 * @example
 * ```ts
 * A12.Documents.Filter.and(
 *     A12.Documents.Filter.field("/Project/Name").equals("A12 Business Scripting"),
 *     A12.Documents.Filter.field("/Project/Status").equals("Active"),
 * )
 *
 * // Three operands
 * A12.Documents.Filter.and(
 *     A12.Documents.Filter.field("/Project/Name").equals("A12 Business Scripting"),
 *     A12.Documents.Filter.field("/Project/Status").equals("Active"),
 *     A12.Documents.Filter.field("/Project/Priority").between(1, 3),
 * )
 *
 * // Nested: AND of a field match and an OR
 * A12.Documents.Filter.and(
 *     A12.Documents.Filter.field("/Project/Name").equals("A12 Business Scripting"),
 *     A12.Documents.Filter.or(
 *         A12.Documents.Filter.field("/Project/Status").equals("Active"),
 *         A12.Documents.Filter.field("/Project/Status").equals("Pending"),
 *     ),
 * )
 * ```
 */
export function and(first: Constraint, second: Constraint, ...rest: Constraint[]): Constraint {
    return { operator: 'and', operands: [first, second, ...rest] };
}

/**
 * Logical OR of two or more constraints.
 *
 * @example
 * ```ts
 * A12.Documents.Filter.or(
 *     A12.Documents.Filter.field("/Project/Status").equals("Active"),
 *     A12.Documents.Filter.field("/Project/Status").equals("Pending"),
 * )
 *
 * // Three operands
 * A12.Documents.Filter.or(
 *     A12.Documents.Filter.field("/Project/Status").equals("Active"),
 *     A12.Documents.Filter.field("/Project/Status").equals("Pending"),
 *     A12.Documents.Filter.field("/Project/Status").equals("Draft"),
 * )
 * ```
 */
export function or(first: Constraint, second: Constraint, ...rest: Constraint[]): Constraint {
    return { operator: 'or', operands: [first, second, ...rest] };
}
