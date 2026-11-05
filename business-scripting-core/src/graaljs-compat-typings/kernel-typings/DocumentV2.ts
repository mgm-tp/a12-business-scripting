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

import {JavaMapEntry, JavaOptional, JavaSet} from "../java-util-typings/index.js";

/**
 * Represents a path (subgroup names and repetitions) into a document.
 */
export interface DocumentPointer {
	getPartAtLevel(level: number): unknown;
	getPathParts(): unknown[];
	size(): number;

	/** @returns the path without the first element */
	rest(): DocumentPointer;
	/** @returns the path without the last element */
	parent(): DocumentPointer;
	withAppended(name: string, repetition: number): DocumentPointer;
	withConcatenated(other: DocumentPointer): DocumentPointer;
	withLastRepetitionReplaced(oneBasedRepetition: number): DocumentPointer;

	/** @returns the full name, e.g. "/Group/Field" */
	fullName(): string;
	repetitionIndexes(): number[];

	isAncestorOf(pointer: DocumentPointer): boolean;
	isDescendantOf(pointer: DocumentPointer): boolean;

	equals(other: unknown): boolean;
	hashCode(): number;
}

/**
 * Static factory methods for DocumentPointer, as returned by {@link Java.type}.
 */
export declare namespace DocumentPointer {
	/** Creates a DocumentPointer from a string path with repetitions, e.g. "/Group[1]/Field[1]" */
	function of(pathWithRepetitions: string): DocumentPointer;
}

/**
 * Represents field instance data within documents
 */
export interface FieldInstanceV2 {
	/**
	 * @return the value of the field instance or null if the field instance has no value.
	 */
	value(): any;

	withValue(value: any): FieldInstanceV2;

	/**
	 * Instances of FieldInstanceV2 are compared for equality based on their current value, independent of the concrete
	 * sub-interface or subclass.
	 */
	equals(other: any): boolean;
}

/**
 * Static factory methods for FieldInstanceV2, as returned by {@link Java.type}.
 */
export declare namespace FieldInstanceV2 {
	/**
	 * @param value
	 * 		the value of the field instance or null if the field instance has no value.<br/>
	 * 		Note that in v2 documents, some date-related field values are represented by different types that in v1
	 * 		documents, see {@link FieldInstanceV2#value}.
	 */
	function ofValue(value: any): FieldInstanceV2;
}

/**
 * Represents repetitions of groups within documents
 */
export interface RepetitionsV2 {
	/**
	 * @param oneBasedIndex
	 * 		the <em>1-based</em> index
	 * @return the group, or null for out-of-bounds index
	 *
	 * @throws IllegalArgumentException
	 * 		if {@literal index <= 0}
	 */
	get(oneBasedIndex: number): GroupInstanceV2;

	/**
	 * the highest 1-based index of any non-null group in this RepetitionsV2 instance
	 */
	size(): number;

	withInserted(oneBasedIndex: number, group: GroupInstanceV2): RepetitionsV2;

	withRemoved(oneBasedIndex: number): RepetitionsV2;

	// util methods (can functionally be implemented based on the core methods):
	toList(): GroupInstanceV2[];
	stream(): unknown;

	/**
	 * Instances of RepetitionsV2 are compared for equality based on their current list value (independent of the concrete
	 * implementation class)
	 */
	equals(other: any): boolean;

	/**
	 * if group is null, this method will return {@code withRemoved(index)} (and not perform an insert)
	 */
	withReplacedAt(index: number, group: GroupInstanceV2): RepetitionsV2;

	/**
	 * @param group
	 * 		must not be null
	 */
	withAppended(group: GroupInstanceV2): RepetitionsV2;
}

/**
 * Static factory methods for RepetitionsV2, as returned by {@link Java.type}.
 */
export declare namespace RepetitionsV2 {
	function empty(): RepetitionsV2;

	function of(repetitions: GroupInstanceV2[]): RepetitionsV2;
}

/**
 * Configuration for document merge operations.
 * Opaque Java type — instances come from GraalVM interop, never constructed in TS.
 * @see com.mgmtp.a12.kernel.md.document.apiV2.IDocumentMergeConfig
 */
export type IDocumentMergeConfig = object;

/**
 * Represents update actions that can be applied to documents.
 * Opaque Java type — instances come from GraalVM interop, never constructed in TS.
 */
export type UpdateAction = object;

/**
 * Base interface for group instances within documents
 */
export interface GroupInstanceV2 {
	/**
	 * @return an RepetitionsV2 with all present repetitions of the subgroup that corresponds to name.
	 * 		If the subgroup is not repeatable, the maximum size of the returned RepetitionsV2 will be 1.
	 * 		If the subgroup is not present (equivalent to no repetition being present), then an empty RepetitionsV2 will be returned.
	 * 		Never returns null.
	 */
	directSubgroup(name: string): RepetitionsV2;

	/**
	 * @return the field, or null if no field with the name is present in the group
	 */
	directField(name: string): FieldInstanceV2;

	/**
	 * @return a read-only collection of read-only Map.Entry objects that represent the named subgroups of this group.
	 * 		Entries that contain an empty RepetitionsV2 will be ommitted.
	 */
	directSubgroups(): JavaSet<JavaMapEntry<string, RepetitionsV2>>;

	/**
	 * @return a read-only collection of read-only Map.Entry objects that represent the named fields in this group.
	 */
	directFields(): JavaSet<JavaMapEntry<string, FieldInstanceV2>>;

	isEmpty(): boolean;

	/** @returns the group at (name, 1-based index), or null if not present */
	directSubgroup(name: string, index: number): GroupInstanceV2 | null;

	/** @returns the group at the given pointer, or null if not present */
	group(pointer: DocumentPointer): GroupInstanceV2 | null;
	group(pointer: string): GroupInstanceV2 | null;

	/** @returns all repetitions of the group pointed to by pointer (last rep must be 0/wildcard) */
	groupAllRepetitions(pointer: DocumentPointer): RepetitionsV2;
	groupAllRepetitions(pointer: string): RepetitionsV2;

	/** @returns the field at the given pointer (last rep must be 1), or null if not present */
	field(pointer: DocumentPointer): FieldInstanceV2 | null;
	field(pointer: string): FieldInstanceV2 | null;

	directFieldValue(name: string): unknown;
	fieldValue(pointer: DocumentPointer): unknown;
	fieldValue(pointer: string): unknown;

	/**
	 * Updates this instance with a direct subgroup
	 */
	withDirectSubgroup(name: string, groupRepetitions: RepetitionsV2): GroupInstanceV2;

	/**
	 * Updates this instance with a direct subgroup at specific index
	 */
	withDirectSubgroup(name: string, index: number, group: GroupInstanceV2): GroupInstanceV2;

	/**
	 * Updates this instance with a direct field
	 */
	withDirectField(name: string, field: FieldInstanceV2): GroupInstanceV2;

	/**
	 * Applies batch updates to this instance
	 */
	withBatchUpdates(updates: UpdateAction[]): GroupInstanceV2;

	/**
	 * Updates a group at the specified pointer
	 */
	withGroup(pointer: DocumentPointer, group: GroupInstanceV2): GroupInstanceV2;
	withGroup(pointer: string, group: GroupInstanceV2): GroupInstanceV2;

	/**
	 * Updates all repetitions of a group at the specified pointer
	 */
	withGroupAllRepetitions(pointer: DocumentPointer, groupRepetitions: RepetitionsV2): GroupInstanceV2;
	withGroupAllRepetitions(pointer: string, groupRepetitions: RepetitionsV2): GroupInstanceV2;

	/**
	 * Inserts a subgroup repetition at the specified index
	 */
	withDirectSubgroupRepetitionInserted(name: string, index: number, group: GroupInstanceV2): GroupInstanceV2;

	/**
	 * Inserts a group repetition at the specified pointer
	 */
	withGroupRepetitionInserted(pointer: DocumentPointer, group: GroupInstanceV2): GroupInstanceV2;
	withGroupRepetitionInserted(pointer: string, group: GroupInstanceV2): GroupInstanceV2;

	/**
	 * Appends a group repetition at the specified pointer
	 */
	withGroupRepetitionAppended(pointer: DocumentPointer, group: GroupInstanceV2): GroupInstanceV2;
	withGroupRepetitionAppended(pointer: string, group: GroupInstanceV2): GroupInstanceV2;

	/**
	 * Removes a group at the specified pointer
	 */
	withGroupRemoved(pointer: DocumentPointer): GroupInstanceV2;
	withGroupRemoved(pointer: string): GroupInstanceV2;

	/**
	 * Removes a direct subgroup at the specified index
	 */
	withDirectSubgroupRemoved(name: string, index: number): GroupInstanceV2;

	/**
	 * Removes all repetitions of a group at the specified pointer
	 */
	withGroupAllRepetitionsRemoved(pointer: DocumentPointer): GroupInstanceV2;
	withGroupAllRepetitionsRemoved(pointer: string): GroupInstanceV2;

	/**
	 * Removes all repetitions of a direct subgroup
	 */
	withDirectSubgroupAllRepetitionsRemoved(name: string): GroupInstanceV2;

	/**
	 * Empties but does not remove a group at the specified pointer
	 */
	withGroupEmptiedButNotRemoved(pointer: DocumentPointer): GroupInstanceV2;
	withGroupEmptiedButNotRemoved(pointer: string): GroupInstanceV2;

	/**
	 * Empties but does not remove a direct subgroup at the specified index
	 */
	withDirectSubgroupEmptiedButNotRemoved(name: string, index: number): GroupInstanceV2;

	/**
	 * Updates a field at the specified pointer
	 */
	withField(pointer: DocumentPointer, field: FieldInstanceV2): GroupInstanceV2;
	withField(pointer: string, field: FieldInstanceV2): GroupInstanceV2;

	/**
	 * Removes a direct field
	 */
	withDirectFieldRemoved(name: string): GroupInstanceV2;

	/**
	 * Removes a field at the specified pointer
	 */
	withFieldRemoved(pointer: DocumentPointer): GroupInstanceV2;
	withFieldRemoved(pointer: string): GroupInstanceV2;

	/**
	 * Updates the value of a direct field
	 */
	withDirectFieldValue(name: string, value: any): GroupInstanceV2;

	/**
	 * Updates the value of a field at the specified pointer
	 */
	withFieldValue(pointer: DocumentPointer, value: any): GroupInstanceV2;
	withFieldValue(pointer: string, value: any): GroupInstanceV2;

	/**
	 * Merges this instance with another group instance
	 */
	withMerged(other: GroupInstanceV2): GroupInstanceV2;
	withMerged(other: GroupInstanceV2, mergeConfig: IDocumentMergeConfig): GroupInstanceV2;
}

/**
 * Static factory methods for GroupInstanceV2, as returned by {@link Java.type}.
 */
export declare namespace GroupInstanceV2 {
	/**
	 * Creates a GroupInstanceV2 with subgroups and fields
	 */
	function of(subGroups: Map<string, RepetitionsV2>, fields: Map<string, FieldInstanceV2>): GroupInstanceV2;
}

/**
 * An alternative interface for accessing and manipulating documents that is more suitable
 * for efficient lookup and update operations with developer-friendly util methods.
 */
export interface DocumentV2 extends GroupInstanceV2 {
	getId(): JavaOptional<string>;

	withId(id: string): DocumentV2;

	getDocumentModelId(): string;

	withDocumentModelId(documentModelId: string): DocumentV2;

	/**
	 * Converts this DocumentV2 to a GroupInstanceV2 representing the root of root groups
	 */
	toRootRootGroup(): GroupInstanceV2;

	/**
	 * Checks equality with another object
	 */
	equals(other: any): boolean;

	/**
	 * Gets the hash code
	 */
	hashCode(): number;

	// Override GroupInstanceV2 methods to return DocumentV2
	group(pointer: DocumentPointer): GroupInstanceV2 | null;
	group(pointer: string): GroupInstanceV2 | null;
	withDirectSubgroup(name: string, groupRepetitions: RepetitionsV2): DocumentV2;
	withDirectSubgroup(name: string, index: number, group: GroupInstanceV2): DocumentV2;
	withDirectField(name: string, field: FieldInstanceV2): DocumentV2;
	withBatchUpdates(updates: UpdateAction[]): DocumentV2;
	withGroup(pointer: DocumentPointer, group: GroupInstanceV2): DocumentV2;
	withGroup(pointer: string, group: GroupInstanceV2): DocumentV2;
	withGroupAllRepetitions(pointer: DocumentPointer, groupRepetitions: RepetitionsV2): DocumentV2;
	withGroupAllRepetitions(pointer: string, groupRepetitions: RepetitionsV2): DocumentV2;
	withDirectSubgroupRepetitionInserted(name: string, index: number, group: GroupInstanceV2): DocumentV2;
	withGroupRepetitionInserted(pointer: DocumentPointer, group: GroupInstanceV2): DocumentV2;
	withGroupRepetitionInserted(pointer: string, group: GroupInstanceV2): DocumentV2;
	withGroupRepetitionAppended(pointer: DocumentPointer, group: GroupInstanceV2): DocumentV2;
	withGroupRepetitionAppended(pointer: string, group: GroupInstanceV2): DocumentV2;
	withGroupRemoved(pointer: DocumentPointer): DocumentV2;
	withGroupRemoved(pointer: string): DocumentV2;
	withDirectSubgroupRemoved(name: string, index: number): DocumentV2;
	withGroupAllRepetitionsRemoved(pointer: DocumentPointer): DocumentV2;
	withGroupAllRepetitionsRemoved(pointer: string): DocumentV2;
	withDirectSubgroupAllRepetitionsRemoved(name: string): DocumentV2;
	withGroupEmptiedButNotRemoved(pointer: DocumentPointer): DocumentV2;
	withGroupEmptiedButNotRemoved(pointer: string): DocumentV2;
	withDirectSubgroupEmptiedButNotRemoved(name: string, index: number): DocumentV2;
	withField(pointer: DocumentPointer, field: FieldInstanceV2): DocumentV2;
	withField(pointer: string, field: FieldInstanceV2): DocumentV2;
	withDirectFieldRemoved(name: string): DocumentV2;
	withFieldRemoved(pointer: DocumentPointer): DocumentV2;
	withFieldRemoved(pointer: string): DocumentV2;
	withDirectFieldValue(name: string, value: any): DocumentV2;
	withFieldValue(pointer: DocumentPointer, value: any): DocumentV2;
	withFieldValue(pointer: string, value: any): DocumentV2;
	withMerged(other: GroupInstanceV2): DocumentV2;
	withMerged(other: GroupInstanceV2, mergeConfig: IDocumentMergeConfig): DocumentV2;
}

/**
 * Static factory methods and utilities for DocumentV2
 */
export declare namespace DocumentV2 {
	/**
	 * Creates an empty document with the specified document model ID
	 */
	function empty(documentModelId: string): DocumentV2;

	/**
	 * Creates an empty document with the specified document model ID and document ID
	 */
	function empty(documentModelId: string, documentId: string): DocumentV2;

	/**
	 * Creates a document with the specified document model ID and subgroups
	 */
	function of(documentModelId: string, subGroups: Map<string, RepetitionsV2>): DocumentV2;

	/**
	 * Creates a document with the specified document model ID, document ID, and subgroups
	 */
	function of(documentModelId: string, documentId: string, subGroups: Map<string, RepetitionsV2>): DocumentV2;

	/**
	 * Creates a document from a root group instance without setting a document ID
	 */
	function ofRootRootGroup(documentModelId: string, rootOfRootGroups: GroupInstanceV2): DocumentV2;

	/**
	 * Creates a document from a root group instance with the specified document model ID and document ID
	 */
	function ofRootRootGroup(documentModelId: string, documentId: string, rootOfRootGroups: GroupInstanceV2): DocumentV2;
}
