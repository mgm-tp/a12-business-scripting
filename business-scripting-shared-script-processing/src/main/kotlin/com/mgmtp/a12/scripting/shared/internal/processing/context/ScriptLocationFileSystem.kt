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

package com.mgmtp.a12.scripting.shared.internal.processing.context

import org.graalvm.polyglot.io.FileSystem
import java.nio.channels.SeekableByteChannel
import java.nio.charset.Charset
import java.nio.file.AccessDeniedException
import java.nio.file.AccessMode
import java.nio.file.CopyOption
import java.nio.file.DirectoryStream
import java.nio.file.LinkOption
import java.nio.file.OpenOption
import java.nio.file.Path
import java.nio.file.attribute.FileAttribute

class ScriptLocationFileSystem(
    scriptLocation: Path,
    private val delegate: FileSystem = FileSystem.newReadOnlyFileSystem(FileSystem.newDefaultFileSystem()),
) : FileSystem by delegate {

    private val scriptLocation: Path = scriptLocation.toAbsolutePath().normalize()

    // --- Read guard ---

    override fun newByteChannel(path: Path, options: Set<OpenOption>, vararg attrs: FileAttribute<*>): SeekableByteChannel {
        val verifiedAndNormalizedPath = verifyPathIsInScriptLocationAndNormalize(path)
        return delegate.newByteChannel(verifiedAndNormalizedPath, options, *attrs)
    }

    override fun newDirectoryStream(dir: Path, filter: DirectoryStream.Filter<in Path>): DirectoryStream<Path> = throw AccessDeniedException(
        dir.toString(),
        null,
        "Directory listing not supported",
    )

    override fun checkAccess(path: Path, modes: Set<AccessMode>, vararg linkOptions: LinkOption) {
        val verifiedAndNormalizedPath = verifyPathIsInScriptLocationAndNormalize(path)
        delegate.checkAccess(verifiedAndNormalizedPath, modes, *linkOptions)
    }

    override fun readAttributes(path: Path, attributes: String, vararg options: LinkOption): MutableMap<String, Any> {
        val verifiedAndNormalizedPath = verifyPathIsInScriptLocationAndNormalize(path)
        return delegate.readAttributes(verifiedAndNormalizedPath, attributes, *options)
    }

    override fun toRealPath(path: Path, vararg linkOptions: LinkOption): Path {
        val verifiedAndNormalizedPath = verifyPathIsInScriptLocationAndNormalize(path)
        val realPath = delegate.toRealPath(verifiedAndNormalizedPath, *linkOptions)
        if (!realPath.startsWith(scriptLocation)) {
            throw AccessDeniedException(path.toString(), null, "Access restricted to script location")
        }
        return realPath
    }

    // --- Access check ---

    /**
     * Verifies that the path actually lies within the scriptLocation
     * If so it returns a normalized path to ending inside the scriptLocation
     * if not a AccessDeniedExecution is thrown
     */
    private fun verifyPathIsInScriptLocationAndNormalize(path: Path): Path {
        val resolved = toAbsolutePath(path).normalize()
        if (!resolved.startsWith(scriptLocation)) {
            throw AccessDeniedException(path.toString(), null, "Access restricted to script location")
        }
        return resolved
    }

    // --- Default method forwarding ---
    // Kotlin's `by` delegation does not generate forwarding overrides for Java default methods.
    // These must be explicit to ensure the delegate's implementation is used, not the interface default.

    override fun createDirectory(dir: Path, vararg attrs: FileAttribute<*>) = delegate.createDirectory(dir, *attrs)

    override fun delete(path: Path) = delegate.delete(path)

    override fun copy(source: Path, target: Path, vararg options: CopyOption) = delegate.copy(source, target, *options)

    override fun move(source: Path, target: Path, vararg options: CopyOption) = delegate.move(source, target, *options)

    override fun createLink(link: Path, existing: Path) = delegate.createLink(link, existing)

    override fun createSymbolicLink(link: Path, target: Path, vararg attrs: FileAttribute<*>) = delegate.createSymbolicLink(link, target, *attrs)

    override fun setAttribute(path: Path, attribute: String, value: Any, vararg options: LinkOption) = delegate.setAttribute(path, attribute, value, *options)

    override fun readSymbolicLink(link: Path): Path = delegate.readSymbolicLink(verifyPathIsInScriptLocationAndNormalize(link))

    override fun setCurrentWorkingDirectory(currentWorkingDirectory: Path) = delegate.setCurrentWorkingDirectory(currentWorkingDirectory)

    override fun getSeparator(): String = delegate.separator

    override fun getPathSeparator(): String = delegate.pathSeparator

    override fun getMimeType(path: Path): String? = delegate.getMimeType(verifyPathIsInScriptLocationAndNormalize(path))

    override fun getEncoding(path: Path): Charset? = delegate.getEncoding(verifyPathIsInScriptLocationAndNormalize(path))

    override fun getTempDirectory(): Path? = delegate.tempDirectory

    override fun isSameFile(path1: Path, path2: Path, vararg options: LinkOption): Boolean = delegate.isSameFile(verifyPathIsInScriptLocationAndNormalize(path1), verifyPathIsInScriptLocationAndNormalize(path2), *options)

    override fun getFileStoreTotalSpace(path: Path): Long = delegate.getFileStoreTotalSpace(verifyPathIsInScriptLocationAndNormalize(path))

    override fun getFileStoreUnallocatedSpace(path: Path): Long = delegate.getFileStoreUnallocatedSpace(verifyPathIsInScriptLocationAndNormalize(path))

    override fun getFileStoreUsableSpace(path: Path): Long = delegate.getFileStoreUsableSpace(verifyPathIsInScriptLocationAndNormalize(path))

    override fun getFileStoreBlockSize(path: Path): Long = delegate.getFileStoreBlockSize(verifyPathIsInScriptLocationAndNormalize(path))

    override fun isFileStoreReadOnly(path: Path): Boolean = delegate.isFileStoreReadOnly(verifyPathIsInScriptLocationAndNormalize(path))
}
