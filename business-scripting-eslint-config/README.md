# business-scripting-eslint-config

The ESLint flat config for authors of A12 Business Scripts. It restricts what a script may import
and applies the style decisions that keep scripts readable for non-developers.

Full documentation is available at [GetA12](https://geta12.com/#/docs).

## Installation

```sh
npm install --save-dev @com.mgmtp.a12.scripting/business-scripting-eslint-config eslint
```

## Usage

Create `eslint.config.mjs` in your scripts project:

```js
import scriptAuthoringConfigs from "@com.mgmtp.a12.scripting/business-scripting-eslint-config"

export default scriptAuthoringConfigs()
```

Scripts may then import from `@com.mgmtp.a12.scripting/business-scripting-core` and from relative
paths only. Pass additional module names to allow them as well:

```js
export default scriptAuthoringConfigs(["uuid"])
```

Test files (`*.test.ts`) additionally may import `chai`, `vitest` and the core `testing` sub-path.

## Development

```sh
npm run build        # compile the TypeScript sources into dist/
npm run test         # run the tests
npm run lint         # report lint violations
npm run format       # fix the lint violations that can be fixed
npm run clean        # delete the compiled output
```
