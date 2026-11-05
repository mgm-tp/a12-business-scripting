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

import com.mgmtp.a12.scripting.shared.internal.config.ScriptingProperties
import org.graalvm.polyglot.io.IOAccess
import java.nio.file.Path

/**
 * Decides which file access a script gets, based on the script location the script itself lies in.
 *
 * Every call builds a fresh [IOAccess] over a fresh [ScriptLocationFileSystem], because the file system instance
 * carries the current working directory of the context it is handed to. Sharing one instance across concurrently
 * created contexts lets them overwrite each other's working directory, so a script would resolve its imports
 * against another script's directory.
 */
class ScriptLocationIoAccessProvider(scriptLocations: List<Path>) {

    private val scriptLocations: List<Path> = scriptLocations.map { it.toAbsolutePath().normalize() }

    fun ioAccessForScriptDirectory(scriptDirectory: Path): IOAccess {
        val absoluteScriptDirectory = scriptDirectory.toAbsolutePath().normalize()
        val containingScriptLocation = scriptLocations.find(absoluteScriptDirectory::startsWith)
            ?: throw IllegalStateException(
                "Script directory '$scriptDirectory' is below none of the configured " +
                    "${ScriptingProperties.SCRIPT_LOCATIONS_PROPERTY} $scriptLocations",
            )
        return IOAccess
            .newBuilder()
            .fileSystem(ScriptLocationFileSystem(containingScriptLocation))
            .build()
    }
}
