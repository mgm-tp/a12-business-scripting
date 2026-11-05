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

import { FSWatcher, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchWithDebounce } from "../watch.js";

const DEBOUNCE_MS = 100;
const WAIT_FOR_TIMEOUT_MS = 1000;
/** Long enough that the change is reported, and its callback still pending, when the watcher closes. */
const PENDING_CALLBACK_DEBOUNCE_MS = 500;
const CHANGE_REPORTING_DELAY_MS = 200;

describe("watchWithDebounce", () => {
  let tempDir: string;
  let watcher: FSWatcher | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devtools-test-"));
  });

  afterEach(() => {
    watcher?.close();
    watcher = undefined;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should call callback after a .ts file changes", async () => {
    // given
    const callback = vi.fn();
    watcher = watchWithDebounce(tempDir, callback, DEBOUNCE_MS);

    // when
    writeFileSync(join(tempDir, "script.ts"), "");

    // then
    await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce(), { timeout: WAIT_FOR_TIMEOUT_MS });
  });

  it("should debounce rapid successive changes into a single callback invocation", async () => {
    // given
    const callback = vi.fn();
    watcher = watchWithDebounce(tempDir, callback, DEBOUNCE_MS);

    // when — three writes within the debounce window
    writeFileSync(join(tempDir, "a.ts"), "");
    writeFileSync(join(tempDir, "b.ts"), "");
    writeFileSync(join(tempDir, "c.ts"), "");

    // then — single debounced invocation
    await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce(), { timeout: WAIT_FOR_TIMEOUT_MS });
  });

  it("should not call callback for a change reported before the watcher was closed", async () => {
    // given — a caller that closes its watchers is shutting down and must not see one more callback
    const callback = vi.fn();
    watcher = watchWithDebounce(tempDir, callback, PENDING_CALLBACK_DEBOUNCE_MS);
    writeFileSync(join(tempDir, "script.ts"), "");
    await new Promise((resolve) => setTimeout(resolve, CHANGE_REPORTING_DELAY_MS));

    // when
    watcher.close();

    // then
    await new Promise((resolve) => setTimeout(resolve, PENDING_CALLBACK_DEBOUNCE_MS * 2));
    expect(callback).not.toHaveBeenCalled();
  });

  it("should not call callback for non-.ts file changes", async () => {
    // given
    const callback = vi.fn();
    watcher = watchWithDebounce(tempDir, callback, DEBOUNCE_MS);

    // when
    writeFileSync(join(tempDir, "readme.md"), "");
    writeFileSync(join(tempDir, "types.d.ts"), "");

    // then — wait longer than the debounce window and confirm no call
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 2));
    expect(callback).not.toHaveBeenCalled();
  });
});