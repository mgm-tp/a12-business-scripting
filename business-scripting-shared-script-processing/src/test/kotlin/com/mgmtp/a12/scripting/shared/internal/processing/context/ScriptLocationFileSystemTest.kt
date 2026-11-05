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

import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import org.graalvm.polyglot.io.FileSystem
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.DisabledOnOs
import org.junit.jupiter.api.condition.OS
import org.junit.jupiter.api.io.TempDir
import java.nio.file.AccessDeniedException
import java.nio.file.AccessMode
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption

private class ScriptLocationFileSystemTest {

    @TempDir
    lateinit var scriptLocation: Path

    @TempDir
    lateinit var otherDir: Path

    private lateinit var fs: FileSystem

    @BeforeEach
    fun setUp() {
        fs = ScriptLocationFileSystem(scriptLocation)
    }

    @Nested
    @DisplayName("Read Access")
    inner class ReadAccess {

        @Test
        fun `should allow reading files within the script location`() {
            // given
            val file = scriptLocation.resolve("chunk.js")
            file.toFile().writeText("export const x = 1")

            // when / then
            shouldNotThrowAny {
                fs.newByteChannel(file, setOf(StandardOpenOption.READ)).close()
            }
        }

        @Test
        fun `should allow reading files in subdirectories of the script location`() {
            // given
            val subDir = scriptLocation.resolve("mrc").also { it.toFile().mkdirs() }
            val file = subDir.resolve("script.js")
            file.toFile().writeText("export const x = 1")

            // when / then
            shouldNotThrowAny {
                fs.newByteChannel(file, setOf(StandardOpenOption.READ)).close()
            }
        }

        @Test
        fun `should deny reading files outside the script location`() {
            // given
            val file = otherDir.resolve("secret.js")
            file.toFile().writeText("secret content")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.newByteChannel(file, setOf(StandardOpenOption.READ))
            }
        }

        @Test
        fun `should allow reading via traversal that stays within script location`() {
            // given — subdir/../chunk.js normalizes to chunk.js inside script location
            val subDir = scriptLocation.resolve("mrc").also { it.toFile().mkdirs() }
            val chunk = scriptLocation.resolve("shared-lib-ABCD.js")
            chunk.toFile().writeText("export const x = 1")
            val traversal = subDir.resolve("../shared-lib-ABCD.js")

            // when / then
            shouldNotThrowAny {
                fs.newByteChannel(traversal, setOf(StandardOpenOption.READ)).close()
            }
        }

        @Test
        fun `should deny path traversal that escapes script location`() {
            // given — path escapes script location via ..
            val traversal = scriptLocation.resolve("../secret.js")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.newByteChannel(traversal, setOf(StandardOpenOption.READ))
            }
        }

        @Test
        fun `should deny directory listing`() {
            shouldThrow<AccessDeniedException> {
                fs.newDirectoryStream(scriptLocation) { true }
            }
        }
    }

    @Nested
    @DisplayName("Metadata guards")
    inner class MetadataGuards {

        @Test
        fun `should deny checkAccess on paths outside script location`() {
            // given
            val file = otherDir.resolve("secret.js")
            file.toFile().writeText("secret")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.checkAccess(file, setOf(AccessMode.READ))
            }
        }

        @Test
        fun `should allow checkAccess on paths inside script location`() {
            // given
            val file = scriptLocation.resolve("chunk.js")
            file.toFile().writeText("export const x = 1")

            // when / then
            shouldNotThrowAny {
                fs.checkAccess(file, setOf(AccessMode.READ))
            }
        }

        @Test
        fun `should deny readAttributes on paths outside script location`() {
            // given
            val file = otherDir.resolve("secret.js")
            file.toFile().writeText("secret")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.readAttributes(file, "basic:*")
            }
        }

        @Test
        fun `should deny toRealPath on paths outside script location`() {
            // given
            val file = otherDir.resolve("secret.js")
            file.toFile().writeText("secret")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.toRealPath(file)
            }
        }

        @Test
        @DisabledOnOs(OS.WINDOWS)
        fun `should deny toRealPath when symlink target escapes script location`() {
            // given
            val target = otherDir.resolve("secret.js")
            target.toFile().writeText("secret")
            val link = scriptLocation.resolve("link.js")
            Files.createSymbolicLink(link, target)

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.toRealPath(link)
            }
        }

        @Test
        @DisabledOnOs(OS.WINDOWS)
        fun `should deny readSymbolicLink on paths outside script location`() {
            // given
            val target = otherDir.resolve("target.js")
            target.toFile().writeText("data")
            val link = otherDir.resolve("link.js")
            Files.createSymbolicLink(link, target)

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.readSymbolicLink(link)
            }
        }

        @Test
        fun `should deny getMimeType on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.getMimeType(otherDir.resolve("secret.js"))
            }
        }

        @Test
        fun `should deny getEncoding on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.getEncoding(otherDir.resolve("secret.js"))
            }
        }

        @Test
        fun `should deny isSameFile when first argument is outside script location`() {
            // given
            val inside = scriptLocation.resolve("chunk.js")
            inside.toFile().writeText("x")
            val outside = otherDir.resolve("secret.js")
            outside.toFile().writeText("y")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.isSameFile(outside, inside)
            }
        }

        @Test
        fun `should deny isSameFile when second argument is outside script location`() {
            // given
            val inside = scriptLocation.resolve("chunk.js")
            inside.toFile().writeText("x")
            val outside = otherDir.resolve("secret.js")
            outside.toFile().writeText("y")

            // when / then
            shouldThrow<AccessDeniedException> {
                fs.isSameFile(inside, outside)
            }
        }

        @Test
        fun `should deny getFileStoreTotalSpace on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.getFileStoreTotalSpace(otherDir)
            }
        }

        @Test
        fun `should deny getFileStoreUnallocatedSpace on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.getFileStoreUnallocatedSpace(otherDir)
            }
        }

        @Test
        fun `should deny getFileStoreUsableSpace on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.getFileStoreUsableSpace(otherDir)
            }
        }

        @Test
        fun `should deny getFileStoreBlockSize on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.getFileStoreBlockSize(otherDir)
            }
        }

        @Test
        fun `should deny isFileStoreReadOnly on paths outside script location`() {
            shouldThrow<AccessDeniedException> {
                fs.isFileStoreReadOnly(otherDir)
            }
        }
    }

    @Nested
    @DisplayName("Write access")
    inner class WriteAccess {

        @Test
        fun `should deny creating directories`() {
            shouldThrow<SecurityException> {
                fs.createDirectory(scriptLocation.resolve("newDir"))
            }
        }

        @Test
        fun `should deny deleting files`() {
            // given
            val file = scriptLocation.resolve("chunk.js")
            file.toFile().createNewFile()

            // when / then
            shouldThrow<SecurityException> {
                fs.delete(file)
            }
        }

        @Test
        fun `should deny copying files`() {
            shouldThrow<SecurityException> {
                fs.copy(scriptLocation.resolve("a.js"), otherDir.resolve("b.js"))
            }
        }

        @Test
        fun `should deny moving files`() {
            shouldThrow<SecurityException> {
                fs.move(scriptLocation.resolve("a.js"), otherDir.resolve("b.js"))
            }
        }

        @Test
        fun `should deny creating hard links`() {
            shouldThrow<SecurityException> {
                fs.createLink(scriptLocation.resolve("link.js"), otherDir.resolve("target.js"))
            }
        }

        @Test
        fun `should deny creating symbolic links`() {
            shouldThrow<SecurityException> {
                fs.createSymbolicLink(scriptLocation.resolve("link.js"), otherDir.resolve("target.js"))
            }
        }

        @Test
        fun `should deny setting file attributes`() {
            // given
            val file = scriptLocation.resolve("chunk.js")
            Files.createFile(file)

            // when / then
            shouldThrow<SecurityException> {
                fs.setAttribute(file, "basic:lastModifiedTime", "value")
            }
        }
    }
}
