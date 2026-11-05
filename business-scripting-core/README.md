# business-scripting-core

The A12 Business Scripting API: the TypeScript library that business scripts are written against.
It provides one API for A12 operations — documents, links, attachments, decisions, logging — that
behaves the same in every context a script runs in.

Full documentation is available at [GetA12](https://geta12.com/#/docs).

## Installation

```sh
npm install @com.mgmtp.a12.scripting/business-scripting-core
```

## Usage

```ts
import { A12, DocumentReference } from "@com.mgmtp.a12.scripting/business-scripting-core"

async function execute() {
  const docRef = await A12.Documents.create("Project_DM", { Project: { Name: "Test" } })
  const name = await A12.Documents.read(docRef, "/Project/Name")
  A12.Log.info("Created " + docRef + " with name " + name)
}
```

The `A12` namespace is the entry point; `A12.Documents`, `A12.Links`, `A12.Decisions`,
`A12.Scripts` and `A12.Log` group the operations.

Test helpers are published separately under the `./testing` sub-path export, so that they never
reach a production bundle.

## Execution contexts

The same script runs in several contexts, and the API adapts to the one it finds:

* **A12 Data Services** — operations call the Data Services Java API directly.
* **CIB 7 workflows** — operations are issued as RPC calls to Data Services.
* **Development and test** — operations run against the services configured for the test run.

A script therefore neither selects nor configures a context; writing against `A12` is enough.

## Development

```sh
npm run build        # compile the TypeScript sources into dist/
npm run build.watch  # recompile on every change
npm run test         # run the tests
npm run lint         # report lint violations
npm run format       # fix the lint violations that can be fixed
npm run api-extract  # write the api-extractor doc model of dist/ to temp/
npm run clean        # delete the compiled output
```

Leave `npm run build.watch` running while you work, so that dependent modules pick changes up
without a manual rebuild.
