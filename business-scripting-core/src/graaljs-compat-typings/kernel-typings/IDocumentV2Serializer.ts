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

import {RankedNotification} from '../base-model-typings/index.js';

import {DocumentV2} from './index.js';

/**
 * A java.io.Reader instance.
 * Opaque: readers are produced by {@link StringReaderJavaClass} and passed straight back into Java
 * calls, never read from TypeScript.
 * @see java.io.Reader
 */
export type Reader = object;

/**
 * Java class proxy for StringReader, as returned by {@link Java.type}.
 * @see java.io.StringReader
 */
export interface StringReaderJavaClass {
    new (input: string): Reader;
}

/**
 * A java.io.Writer instance, as produced by {@link StringWriterJavaClass}.
 * @see java.io.Writer
 */
export interface Writer {
    toString(): string;
}

/**
 * Java class proxy for StringWriter, as returned by {@link Java.type}.
 * @see java.io.StringWriter
 */
export interface StringWriterJavaClass {
    new (): Writer;
}

/**
 * Callback for handling notifications during deserialization
 */
export type RankedNotificationConsumer = (notification: RankedNotification) => void;

/**
 * Serialization format enum instance (JSON or XML).
 * Access via DocumentSerializationConfigJavaClass.Format.JSON / .XML.
 * @see com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig.Format
 */
export type DocumentSerializationFormat = object;

/**
 * Configuration for document deserialization.
 * @see com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig
 */
export type DocumentDeserializationConfig = object;

/**
 * Builder for {@link DocumentDeserializationConfig}.
 */
export interface DocumentDeserializationConfigBuilder {
    format(format: DocumentSerializationFormat): DocumentDeserializationConfigBuilder;
    removeEmptyFieldsAndGroups(remove: boolean): DocumentDeserializationConfigBuilder;
    ignoreUnknownEntities(ignore: boolean): DocumentDeserializationConfigBuilder;
    build(): DocumentDeserializationConfig;
}

/**
 * Java class proxy for DocumentDeserializationConfig, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig
 */
export interface DocumentDeserializationConfigJavaClass {
    builder(): DocumentDeserializationConfigBuilder;
}

/**
 * Configuration for document serialization.
 * @see com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig
 */
export type DocumentSerializationConfig = object;

/**
 * Builder for {@link DocumentSerializationConfig}.
 */
export interface DocumentSerializationConfigBuilder {
    format(format: DocumentSerializationFormat): DocumentSerializationConfigBuilder;
    skipTransientFields(skip: boolean): DocumentSerializationConfigBuilder;
    removeEmptyFieldsAndGroups(remove: boolean): DocumentSerializationConfigBuilder;
    ignoreUnknownEntities(ignore: boolean): DocumentSerializationConfigBuilder;
    build(): DocumentSerializationConfig;
}

/**
 * Java class proxy for DocumentSerializationConfig, as returned by {@link Java.type}.
 * @see com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig
 */
export interface DocumentSerializationConfigJavaClass {
    builder(): DocumentSerializationConfigBuilder;
    Format: { JSON: DocumentSerializationFormat; XML: DocumentSerializationFormat };
}

/**
 * Serializer for DocumentV2 instances.
 * Handles conversion between JSON strings and DocumentV2 objects.
 *
 * Injected into the script context as a global binding; reachable as
 * DataServicesContext#documentV2Serializer.
 *
 * @see com.mgmtp.a12.kernel.md.document.apiV2.services.IDocumentV2Serializer
 */
export interface IDocumentV2Serializer {
    /**
     * Deserializes a document from a Reader.
     *
     * @param reader - Java Reader containing the document JSON (e.g., StringReader)
     * @param documentModelId - The document model ID
     * @param config - Deserialization configuration
     * @param notificationConsumer - Callback for deserialization notifications
     * @returns The deserialized DocumentV2
     */
    'deserializeV2(java.io.Reader,java.lang.String,com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig,java.util.function.Consumer)'(
        reader: Reader,
        documentModelId: string,
        config: DocumentDeserializationConfig,
        notificationConsumer: RankedNotificationConsumer,
    ): DocumentV2;

    /**
     * Deserializes a document from a Jackson JsonNode.
     *
     * @param json - Jackson JsonNode containing the document
     * @param documentModelId - The document model ID
     * @param config - Deserialization configuration
     * @param notificationConsumer - Callback for deserialization notifications
     * @returns The deserialized DocumentV2
     */
    'deserializeV2(tools.jackson.databind.JsonNode,java.lang.String,com.mgmtp.a12.kernel.md.document.api.services.DocumentDeserializationConfig,java.util.function.Consumer)'(
        json: unknown,
        documentModelId: string,
        config: DocumentDeserializationConfig,
        notificationConsumer: RankedNotificationConsumer,
    ): DocumentV2;

    /**
     * Serializes a DocumentV2 to a Writer.
     *
     * @param document - The document to serialize
     * @param writer - Java Writer to write the output to (e.g., StringWriter)
     * @param config - Serialization configuration
     */
    'serializeV2(com.mgmtp.a12.kernel.md.document.apiV2.immutable.DocumentV2,java.io.Writer,com.mgmtp.a12.kernel.md.document.api.services.DocumentSerializationConfig)'(
        document: DocumentV2,
        writer: Writer,
        config: DocumentSerializationConfig,
    ): void;
}
