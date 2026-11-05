# business-scripting-devtools

Build tooling for [A12 Business Scripting](https://www.geta12.com) consumers. Provides the reusable build pipeline logic — entrypoint discovery, source map post-processing, script metadata injection, and file watching — as a versioned, publishable library so consumer projects do not need to copy or maintain this logic themselves.

## Installation

```sh
npm install --save-dev @com.mgmtp.a12.scripting/business-scripting-devtools
```

Consumer `tsconfig.json` must use `"moduleResolution": "node16"`, `"nodenext"`, or `"bundler"` to resolve the `./esbuild` sub-path export.

## Using with esbuild

For the standard case, one call is all you need:

```js
// esbuild.build.js
import { setupEsbuild } from "@com.mgmtp.a12.scripting/business-scripting-devtools/esbuild"

await setupEsbuild("./src", "./build")
```

Run with `node esbuild.build.js` to build once, or `node esbuild.build.js --watch` for watch mode.

To keep scripts separated by concern, pass a list of source directories instead of one:

```js
await setupEsbuild(["./example-scripts/src", "./workflow-scripts/src"], "./build")
```

With several source directories, each one's output is grouped under its own directory name — `build/example-scripts/…`, `build/workflow-scripts/…`. A single source directory produces no such prefix. Script names must still be unique across all source directories, because a script is identified at runtime by its filename alone; the build fails if two directories contain the same script name.

### Shared code chunks

The code a group of scripts has in common — most of it the Business Scripting API itself — is written once into a `shared-lib-<hash>.js` chunk that the scripts import, instead of being inlined into every one of them. This is the default and the recommended setup, because it is what keeps the output small.

Two consequences to be aware of:

- **The output group is the deduplication boundary.** Scripts share a chunk only with the other scripts of their own source directory, and a group holding a single script gets no chunk at all — there is nothing to share it with.
- **The chunk must stay inside the script location.** At runtime a script may only read files from the script location it was loaded from, so each group writes to its own output directory and its chunk lands next to the scripts importing it. A build that places the chunk anywhere else produces scripts that fail to load.

The runtime recognises a chunk by its `shared-lib-` filename prefix and does not register it as a callable script. Keep the prefix in sync with `mgmtp.a12.scripting.chunk-name-prefixes` if you configure your own chunk names.

For a deployment that cannot ship the chunk beside the scripts, splitting can be switched off; every script then carries its own copy of the shared code:

```js
await setupEsbuild("./src", "./build", { splitting: false })
```

The output then grows by roughly the size of the Business Scripting API per script. Prefer the default unless the deployment leaves no choice.

## Build settings

`setupEsbuild`'s third argument carries every setting. All of them are optional.

| Setting | Values | Default | Effect |
|---|---|---|---|
| `watch` | `true`, `false` | whether `--watch` is on the command line | Rebuilds on every source change instead of building once. |
| `splitting` | `true`, `false` | `true` | The code a group's scripts share becomes one `shared-lib-<hash>.js` chunk. With `false` every script carries its own copy. |
| `production` | `true`, `false` | whether `--production` is on the command line | Builds for a deployment: every setting listed under [Production builds](#production-builds) takes its production value unless set explicitly. |
| `sourceMaps` | `"inline"`, `"off"` | the value of `--source-maps=<value>` on the command line, otherwise `"off"` under `production` and `"inline"` without it | With `"inline"` every script ends with its own source map. With `"off"` no map is written at all. |
| `typeCheckCommand` | any shell command | absent, which builds without a type check | Runs before every build. A non-zero exit fails the build and reports the command's output. Also warns when `tsconfig.json` allows built-ins the engine lacks: above `es2025`, or a browser API such as `setTimeout`. |

An explicit setting wins over the command line. A misspelled setting or value fails the build
instead of falling back to the default.

### Production builds

The defaults serve the development loop. `production` selects, for every setting a deployment
should not inherit from it, the value a deployment needs:

| Setting | Under `production` | Why |
|---|---|---|
| `sourceMaps` | `"off"` | A map roughly doubles the size of every script. |

Nothing else changes: the scripts, chunks and their layout are the same as in a development build.
Any setting named explicitly, in the options or by its own command-line flag, wins over the preset,
so `--production --source-maps=inline` is a production build that keeps its maps.

Because the preset can come from the command line, one build script serves both cases. Add the
npm script and nothing else:

```json
"build": "node esbuild.build.js",
"build.production": "node esbuild.build.js --production"
```

### Source maps

A source map is what turns a failure inside a script into the line number of the TypeScript file the
script was written in, and what lets a debugger step through that file instead of the transpiled
JavaScript. It roughly doubles the size of the script.

Build with `sourceMaps: "off"`, as the production preset does, to keep the scripts small. A failure
report then names the script but no line in it, and a debugger shows the built JavaScript. The
source paths stay named either way, in esbuild's comment above each bundled module.

The setting can also come from the command line on its own, as `--source-maps=off`.

### Type checking

esbuild transpiles each file on its own and never checks types, so a type error otherwise reaches the
built script unnoticed. Name a command that checks them and it gates every build, watch mode
included:

```json
"typecheck": "tsc --noEmit",
```

```js
await setupEsbuild("./src", "./build", { typeCheckCommand: "npm run typecheck" })
```

A failing check writes no output, and in watch mode removes what the previous build wrote; the
scripts reappear once the check passes. A watch session stays alive through it and rebuilds on the next edit. It
rebuilds, and so checks again, only when a file the scripts bundle changes: an edit to a file that
holds nothing but types is checked with the next such change. What the build reports are the type
checker's own messages. Keeping the command as an npm script also leaves
it available to run on its own, in CI or in an editor.

The command runs once per output group, and the groups build concurrently. Avoid a command that
writes shared state, such as `tsc --incremental`, whose `.tsbuildinfo` concurrent runs would overwrite.

Set `"lib": ["es2025"]` in `tsconfig.json` — the level the script engine implements. A higher level,
a browser library such as `dom`, or no `lib` at all (TypeScript then adds the DOM) type-checks
built-ins the engine does not have; the build pins the syntax level but cannot lower or polyfill a
built-in, so such a script fails when it runs.
The build reads `lib` from `tsconfig.json` and warns in each of these cases, without failing: the
`tsconfig.json` is yours, and the type-check command may check a different project than the default
one the level is read from.

### What the build decides on its own

Three properties of the output are not settings:

- **Only scripts are built.** A `.ts` file that declares no entry function is a helper module: it is
  bundled into the scripts importing it and produces no output of its own. A source file with
  runtime code that reaches no script is reported by name after the build. A file holding only type
  declarations is not.
- **The syntax level is pinned** to what the A12 script engine can parse. Scripts may be written in
  newer syntax; the build transpiles it down.
- **The platform is the script engine's.** GraalJS is neither a browser nor Node, so the build
  resolves no package to a variant written for either: a package's `module` entry is preferred, its
  `main` entry is the fallback, and a Node built-in fails the build instead of the script.

## Custom bundler configuration

For consumers that need custom esbuild config, the lower-level APIs remain available:

```js
import { rmSync } from "fs"
import { context as esbuildContext } from "esbuild"
import { discoverEntryPoints } from "@com.mgmtp.a12.scripting/business-scripting-devtools"
import {
  keepEntryFunctionPlugin,
  createPostBuildPlugin,
  watchEsbuild,
} from "@com.mgmtp.a12.scripting/business-scripting-devtools/esbuild"

const SOURCE_DIR = "./src"
const BUILD_DIR = "./build"

async function createContext(entryPoints) {
  return esbuildContext({
    entryPoints,
    bundle: true,
    splitting: true,
    chunkNames: "shared-lib-[hash]",
    format: "esm",
    platform: "neutral",
    mainFields: ["module", "main"],
    target: "es2025",
    sourcemap: "inline",
    sourcesContent: false,
    outdir: BUILD_DIR,
    plugins: [keepEntryFunctionPlugin, createPostBuildPlugin({ sourceDir: SOURCE_DIR, buildDir: BUILD_DIR })],
  })
}

const entryPoints = discoverEntryPoints(SOURCE_DIR)
const ctx = await createContext(entryPoints)

rmSync(BUILD_DIR, { recursive: true, force: true })
await ctx.rebuild()

if (process.argv.includes("--watch")) {
  const watchers = await watchEsbuild({ ctx, entryPoints, sourceDir: SOURCE_DIR, buildDir: BUILD_DIR, createContext })
  process.on("SIGINT", () => { watchers.forEach((watcher) => watcher.close()); process.exit(0) })
} else {
  await ctx.dispose()
}
```

This single context is enough for one source directory, because its `outdir` is where the scripts themselves are written. With several source directories, one context per directory is needed instead — each with its own `outdir` — so that every group's chunk stays with the scripts importing it. Use `discoverEntryPointGroups` to get the groups and `combineBuildContexts` to drive them as one context. `createContextForGroup` below is your own function: the `esbuildContext` call above, taking the group's entry points and its `outdir`, with `createKeepEntryFunctionPlugin(SOURCE_DIRS)` in place of `keepEntryFunctionPlugin`, which only covers `./src`:

```js
import { join } from "path"
import { discoverEntryPointGroups } from "@com.mgmtp.a12.scripting/business-scripting-devtools"
import { combineBuildContexts } from "@com.mgmtp.a12.scripting/business-scripting-devtools/esbuild"

const groupedBuildContexts = await Promise.all(
  discoverEntryPointGroups(SOURCE_DIRS).map(async (group) => ({
    outputSubdirectory: group.outputSubdirectory,
    buildContext: await createContextForGroup(group, join(BUILD_DIR, group.outputSubdirectory)),
  }))
)
const ctx = combineBuildContexts(groupedBuildContexts)
```

`ctx.rebuild()`, `ctx.watch()` and `ctx.dispose()` then fan out to every group and report which group failed.

## Using with other bundlers

The root entry point (`.`) exports the bundler-agnostic functions only. Use them with any bundler by wiring the post-build steps yourself. `esbuild` is never installed or imported.

The example below uses webpack:

```js
// webpack.build.js
import { rmSync } from "fs"
import { resolve as resolvePath } from "path"
import webpack from "webpack"
import {
  discoverEntryPoints,
  injectScriptMetadata,
  stripNodeModulesFromSourceMaps,
} from "@com.mgmtp.a12.scripting/business-scripting-devtools"

const SOURCE_DIR = "./src"
const BUILD_DIR = "./build"

const entryPoints = discoverEntryPoints(SOURCE_DIR)
const entry = Object.fromEntries(
  entryPoints.map(({ in: sourcePath, out }) => [out, resolvePath(sourcePath)])
)

rmSync(BUILD_DIR, { recursive: true, force: true })

const compiler = webpack({
  mode: "development",
  entry,
  output: {
    path: resolvePath(BUILD_DIR),
    filename: "[name].js",
    module: true,
    library: { type: "module" },
  },
  experiments: { outputModule: true },
  externalsType: "module",
  // Externalize runtime dependencies (A12 packages are provided by the host environment).
  externals: [/^@com\.mgmtp\.a12\./],
  // Preserve top-level function declarations so injectScriptMetadata can find them.
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
            compilerOptions: { module: "esnext", moduleResolution: "bundler" },
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: { extensions: [".ts", ".js"] },
  target: ["web", "es2022"],
})

await new Promise((done, reject) => {
  compiler.run((err, stats) => {
    compiler.close((closeErr) => {
      if (err) return reject(err)
      if (closeErr) return reject(closeErr)
      if (stats?.hasErrors()) return reject(new Error(stats.toString("errors-only")))
      done(undefined)
    })
  })
})

// Post-build steps: same API regardless of bundler.
injectScriptMetadata({ buildDir: BUILD_DIR, entryPoints })
stripNodeModulesFromSourceMaps(BUILD_DIR)
```

Required devDependencies for the webpack example: `webpack`, `ts-loader`.

## API reference

### Generic API (`@.../business-scripting-devtools`)

| Export | Description |
|---|---|
| `discoverEntryPoints(sourceDir)`<br>`discoverEntryPoints(sourceDirs)` | Recursively finds the scripts under one or several source directories — the `.ts` files declaring an entry function, so no `.d.ts` and no helper module — and pairs each with the output path it must be written to: `{ in, out }`. With several source directories, `out` is prefixed with the directory's own name. Throws if no source directory is passed. |
| `discoverEntryPointGroups(sourceDir)`<br>`discoverEntryPointGroups(sourceDirs)` | Same discovery, but keeps the output groups apart instead of flattening them: one `EntryPointGroup` per source directory, whose `out` paths are relative to the group's own output subdirectory. Use this when each group needs its own bundler output directory, as code splitting does. Throws if no source directory is passed. |
| `EntryPoint` | Type of the entries returned by `discoverEntryPoints` and accepted by `injectScriptMetadata` / `createPostBuildPlugin`: `{ in: string; out: string }` — source path and output path without extension. |
| `EntryPointGroup` | Type of the groups returned by `discoverEntryPointGroups`: `{ sourceDirectory: string; outputSubdirectory: string; entryPoints: EntryPoint[] }`. `outputSubdirectory` is the path below the build directory — empty for a single source directory. Two source directories may not derive the same one; `setupEsbuild` rejects that, because both groups would build into one directory. |
| `injectScriptMetadata({ buildDir, entryPoints })` | Reads each `.ts` source named by `entryPoints`, injects `__functionName` / `__paramTypes` / `__returnProperties` into the corresponding built `.js`, and strips the ESM export block. |
| `stripNodeModulesFromSourceMaps(buildDir)` | Removes `node_modules` sources from inline base64 source maps in all `.js` files under `buildDir`. |
| `watchWithDebounce(sourceDir, callback, debounceMs)` | Watches `sourceDir` for `.ts` changes; calls `callback` after `debounceMs` ms of inactivity. Returns an `FSWatcher`; closing it also cancels a pending callback. |
| `signatureRegex` | Regex that matches a top-level TypeScript function declaration (plain, `async`, `export`, `export default`, or combinations) and captures name, params, and return type. |
| `declaresEntryFunction(tsSource)` | Whether a TypeScript source declares an entry function, i.e. is a script rather than a helper module. The rule `discoverEntryPoints` applies; use it to select scripts in a pipeline for another bundler. |
| `exportBlockRegex` | Regex that matches an ESM `export { ... };` block — used internally by `injectScriptMetadata` to strip the bundler-injected export after metadata injection. |

### esbuild API (`@.../business-scripting-devtools/esbuild`)

| Export | Description |
|---|---|
| `setupEsbuild(sourceDir, buildDir, options?)`<br>`setupEsbuild(sourceDirs, buildDir, options?)` | Standard-case entry point: discovers entrypoints in every source directory, builds each source directory's group in its own context with canonical config (including code splitting), respects `--watch`. |
| `SetupEsbuildOptions` | Optional third argument of `setupEsbuild`: `{ watch?: boolean; splitting?: boolean; production?: boolean; sourceMaps?: "inline" \| "off"; typeCheckCommand?: string }`. See [Build settings](#build-settings). |
| `SOURCE_MAPS_SETTINGS` | The accepted values of the `sourceMaps` setting, `["inline", "off"]`. |
| `SourceMapsSetting` | Type of the `sourceMaps` setting: `"inline" \| "off"`. |
| `PRODUCTION_PRESET` | The value every setting covered by `production` takes under it; see [Production builds](#production-builds). |
| `createTypeCheckPlugin(typeCheckCommand)` | esbuild plugin factory that runs the command before every build and fails the build with its output. `setupEsbuild` registers it for you when `typeCheckCommand` is set; use it directly only in a hand-written pipeline. |
| `warnAboutLibraryLevel()` | Warns when `tsconfig.json` type-checks built-ins the script engine lacks: above its level, or browser APIs, including the DOM TypeScript adds without `lib`. `setupEsbuild` calls it once per run when `typeCheckCommand` is set; use it directly only in a hand-written pipeline. |
| `keepEntryFunctionPlugin` | esbuild plugin that prevents tree-shaking of the entry-point function for scripts under `./src`. |
| `createKeepEntryFunctionPlugin(sourceDirs)` | Same plugin for scripts under any set of source directories. |
| `createPostBuildPlugin({ sourceDir, buildDir })`<br>`createPostBuildPlugin({ sourceDirs, buildDir })`<br>`createPostBuildPlugin({ entryPoints, buildDir })` | esbuild plugin factory that wires `injectScriptMetadata` and `stripNodeModulesFromSourceMaps` into `onEnd`. |
| `watchEsbuild(options)` | Manages the full esbuild watch lifecycle, including context recreation when entrypoints change. Takes `sourceDir` or `sourceDirs`. Returns `Promise<FSWatcher[]>` — one watcher per source directory; the caller should close them all on graceful shutdown. |
| `combineBuildContexts(groupedBuildContexts)` | Turns one build context per output group into a single `CombinedBuildContext` whose `rebuild` / `watch` / `dispose` run on every group concurrently. Failures name the group that failed and keep the original error as `cause`; the operation still runs on all other groups. |
| `CombinedBuildContext` | Type accepted by `watchEsbuild` and returned by `combineBuildContexts`: the `rebuild` / `watch` / `dispose` subset of an esbuild `BuildContext`, which a plain esbuild context also satisfies. |
| `GroupedBuildContext` | Type of the entries `combineBuildContexts` takes: `{ outputSubdirectory: string; buildContext: CombinedBuildContext }`. The subdirectory is only used to name the group in error messages. |

## Behaviour change: helper modules are no longer built as scripts

`discoverEntryPoints` and `discoverEntryPointGroups` keep their signatures, but return only the
`.ts` files that declare an entry function. A helper module is bundled into the scripts importing it
instead of being built into an output file of its own, which at runtime was registered as a script
that cannot be called. The pinned syntax level and platform can change the output too; see
[What the build decides on its own](#what-the-build-decides-on-its-own).

## Migrating from single-source-directory versions

Support for several source directories changed three signatures, and `setupEsbuild` took an options object in place of its watch flag. `setupEsbuild("./src", "./build")` is unaffected — only projects passing that flag or wiring the lower-level APIs themselves need these edits.

| Before | Now |
|---|---|
| `setupEsbuild("./src", "./build", true)` | `setupEsbuild("./src", "./build", { watch: true })`. A bare boolean is rejected with an error rather than silently ignored. |
| `discoverEntryPoints("./src")` returned `string[]` of source paths | returns `EntryPoint[]` — `{ in, out }` pairs. Use `entryPoint.in` where the path was used, and `entryPoint.out` for the output path you previously derived yourself. |
| `injectScriptMetadata({ buildDir, sourceDir })` | `injectScriptMetadata({ buildDir, entryPoints })` — pass the result of `discoverEntryPoints`. The `sourceDir` option is gone. |
| `const watcher = await watchEsbuild(...)`, then `watcher.close()` | `const watchers = await watchEsbuild(...)`, then `watchers.forEach((watcher) => watcher.close())`. One watcher per source directory. |

The `watchEsbuild` change is the one to watch for in plain JavaScript: calling `.close()` on the returned array is `undefined` and fails at runtime rather than at compile time.
