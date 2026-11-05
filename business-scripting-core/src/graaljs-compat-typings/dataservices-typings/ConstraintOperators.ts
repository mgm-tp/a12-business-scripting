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
 * Opaque type representing any built Java constraint operator passed to {@link QueryRootBuilder.constraint}.
 * @see com.mgmtp.a12.dataservices.query.constraint
 */
export type JavaConstraint = object;

// =============================================================================
// ExactMatchOperator
// =============================================================================

/**
 * Builder for {@link ExactMatchOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator
 */
export interface ExactMatchOperatorBuilder {
    field(field: string): ExactMatchOperatorBuilder;
    value(value: string | number | boolean): ExactMatchOperatorBuilder;
    values(values: (string | number | boolean)[]): ExactMatchOperatorBuilder;
    caseSensitive(caseSensitive: boolean): ExactMatchOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for ExactMatchOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.matching.ExactMatchOperator
 */
export interface ExactMatchOperatorJavaClass {
    builder(): ExactMatchOperatorBuilder;
}

// =============================================================================
// DoubleRangeOperator
// =============================================================================

/**
 * Builder for {@link DoubleRangeOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.range.DoubleRangeOperator
 */
export interface DoubleRangeOperatorBuilder {
    field(field: string): DoubleRangeOperatorBuilder;
    from(from: number): DoubleRangeOperatorBuilder;
    to(to: number): DoubleRangeOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for DoubleRangeOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.range.DoubleRangeOperator
 */
export interface DoubleRangeOperatorJavaClass {
    builder(): DoubleRangeOperatorBuilder;
}

// =============================================================================
// DateRangeOperator
// =============================================================================

/**
 * Builder for {@link DateRangeOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.range.DateRangeOperator
 */
export interface DateRangeOperatorBuilder {
    field(field: string): DateRangeOperatorBuilder;
    from(from: string): DateRangeOperatorBuilder;
    to(to: string): DateRangeOperatorBuilder;
    value(value: string): DateRangeOperatorBuilder;
    reverse(reverse: boolean): DateRangeOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for DateRangeOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.range.DateRangeOperator
 */
export interface DateRangeOperatorJavaClass {
    builder(): DateRangeOperatorBuilder;
}

// =============================================================================
// SimpleSearchOperator
// =============================================================================

/**
 * Builder for {@link SimpleSearchOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.matching.SimpleSearchOperator
 */
export interface SimpleSearchOperatorBuilder {
    value(value: string): SimpleSearchOperatorBuilder;
    values(values: string[]): SimpleSearchOperatorBuilder;
    fields(fields: string[]): SimpleSearchOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for SimpleSearchOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.matching.SimpleSearchOperator
 */
export interface SimpleSearchOperatorJavaClass {
    builder(): SimpleSearchOperatorBuilder;
}

// =============================================================================
// AndOperator
// =============================================================================

/**
 * Builder for {@link AndOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.logical.AndOperator
 */
export interface AndOperatorBuilder {
    operands(operands: JavaConstraint[]): AndOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for AndOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.logical.AndOperator
 */
export interface AndOperatorJavaClass {
    builder(): AndOperatorBuilder;
}

// =============================================================================
// OrOperator
// =============================================================================

/**
 * Builder for {@link OrOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.logical.OrOperator
 */
export interface OrOperatorBuilder {
    operands(operands: JavaConstraint[]): OrOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for OrOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.logical.OrOperator
 */
export interface OrOperatorJavaClass {
    builder(): OrOperatorBuilder;
}

// =============================================================================
// NotOperator
// =============================================================================

/**
 * Builder for {@link NotOperatorJavaClass}.
 * @see com.mgmtp.a12.dataservices.query.constraint.logical.NotOperator
 */
export interface NotOperatorBuilder {
    operand(operand: JavaConstraint): NotOperatorBuilder;
    build(): JavaConstraint;
}

/**
 * Java class proxy for NotOperator, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.dataservices.query.constraint.logical.NotOperator
 */
export interface NotOperatorJavaClass {
    builder(): NotOperatorBuilder;
}
