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

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import webpack from "webpack";

import { discoverEntryPoints } from "../entryPoints.js";
import { injectScriptMetadata } from "../scriptMetadata.js";
import { stripNodeModulesFromSourceMaps } from "../sourceMap.js";

const DEVTOOLS_ROOT = process.cwd();
const EXAMPLE_SCRIPT_TS = "exampleScript.ts";

const FIXTURE_TS = `\
interface Inputs {
  name: string;
}
interface Outputs {
  result: string;
}
function execute(inputs: Inputs): Outputs {
  return { result: inputs.name };
}
`;

describe("webpack integration", () => {
  let tempDir: string;
  let outputContent: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "devtools-webpack-test-"));
    const sourceDir = join(tempDir, "src");
    const buildDir = join(tempDir, "build");
    mkdirSync(sourceDir);
    mkdirSync(buildDir);
    writeFileSync(join(sourceDir, EXAMPLE_SCRIPT_TS), FIXTURE_TS);
    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, module: "esnext", moduleResolution: "bundler", target: "esnext", skipLibCheck: true } }),
    );

    await runWebpackBuild(sourceDir, buildDir, join(tempDir, "tsconfig.json"));
    injectScriptMetadata({ buildDir, entryPoints: discoverEntryPoints(sourceDir) });
    stripNodeModulesFromSourceMaps(buildDir);
    outputContent = readFileSync(join(buildDir, "exampleScript.js"), "utf-8");
  }, 30000);

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should inject __paramTypes", () => {
    expect(outputContent).toContain('execute.__paramTypes = {"name":"string"};');
  });

  it("should inject __returnProperties", () => {
    expect(outputContent).toContain('execute.__returnProperties = {"result":"string"};');
  });

  it("should have no node_modules sources in the inline source map", () => {
    // given
    const sourceMapMatch = outputContent.match(
      /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/,
    );

    // when
    expect(sourceMapMatch).not.toBeNull();
    const sourceMap = JSON.parse(Buffer.from(sourceMapMatch![1]!, "base64").toString("utf-8")) as { sources?: string[] };

    // then
    for (const source of sourceMap.sources ?? []) {
      expect(source).not.toContain("node_modules");
    }
  });
});

function runWebpackBuild(sourceDir: string, buildDir: string, tsconfigPath: string): Promise<void> {
  const compiler = webpack({
    context: DEVTOOLS_ROOT,
    mode: "development",
    entry: { exampleScript: join(sourceDir, EXAMPLE_SCRIPT_TS) },
    output: {
      path: buildDir,
      filename: "[name].js",
      module: true,
      library: { type: "module" },
    },
    experiments: { outputModule: true },
    externalsType: "module",
    optimization: { usedExports: false, minimize: false },
    devtool: "inline-source-map",
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: tsconfigPath,
              compilerOptions: { module: "esnext", moduleResolution: "bundler" },
            },
          },
        },
      ],
    },
    resolve: { extensions: [".ts", ".js"] },
    target: ["web", "es2022"],
  });

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      compiler.close((closeErr) => {
        if (err) { return reject(err); }
        if (closeErr) { return reject(closeErr); }
        if (stats?.hasErrors()) {
          return reject(new Error(stats.toString({ errors: true, errorDetails: true, colors: false })));
        }
        resolve();
      });
    });
  });
}
