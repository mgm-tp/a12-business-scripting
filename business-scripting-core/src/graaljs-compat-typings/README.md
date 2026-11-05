# graaljs-compat-typings

TypeScript declarations for the Java classes Business Scripting reaches through GraalJS. This
directory is the only place where such declarations live.

Subdirectories group the declarations by the Java package or A12 component they mirror:
`java-lang-typings`, `java-util-typings`, `jackson-typings`, `kernel-typings`,
`dataservices-typings`, `workflows-typings`, `base-model-typings`.

## Which declaration form to use

| Form | Use it for | Notes |
|---|---|---|
| `export interface X` | The shape of a Java **instance**, and the shape of a Java **class object** (`XJavaClass`) | The default. Covers almost everything here. |
| `export type X = object` | A Java value we only hold and hand back, never call methods on | Opaque handle. Never `unknown` or `{}` — both accept any value and would silently weaken every parameter typed `X`. |
| `export type X = ...` | A union, alias or callback signature | e.g. `OrderDirection = 'ASC' \| 'DESC'`. |
| `export declare namespace X` | The **static** members of a Java class that is also declared as an interface | The one place `declare` is required: without it TypeScript demands a function body. It gives `X` a value side, which is what lets `java-classes.ts` write `as typeof X`. |
| `declare global` in a `.d.ts` | Bindings the Java host injects into the script scope | Only `graaljs-injected-globals.d.ts`, and it must stay there — see *Runtime code*. |

**Do not write `export declare interface` or `export declare type`.** On an interface or a type
alias, `declare` is a no-op — `export declare interface X` and `export interface X` compile to
exactly the same thing. Keeping `declare` out of them means every remaining `declare` in this
project signals something real: *a value exists at runtime that we do not emit.*

`export declare class` is not used here. A Java class object is obtained from `Java.type(...)`,
not from a global binding, so it is modelled as an `XJavaClass` interface carrying the constructors
and static members — see `DocumentReferenceJavaClass`.

## Instance types versus class types

Java statics are members of the class, not of the instance, so they are declared separately:

- `DocumentReference` — what a document reference instance offers.
- `DocumentReferenceJavaClass` — what `Java.type('…DocumentReference')` offers: `new (…)`,
  `SEPARATOR`, `MODEL_NAME_PATTERN`.

## Reaching a Java class

`Java`, the GraalVM-injected interop object, is imported from this directory's barrel.

`JavaInterop.type()` returns `unknown`. Add a typed accessor in
`src/internal/java-classes.ts` and cast there, so that every Java class this project depends on
is listed in one file. The accessor is named after the type it returns, so that its name says it
hands back the class object rather than an instance:

```ts
export const getUuidJavaClass = () => Java.type('java.util.UUID') as UuidJavaClass;
```

Never call `Java.type(...)` anywhere else.

To construct an instance, bind the class to a local named after the Java class — `new
(getStringWriterJavaClass())()` is not used here:

```ts
const StringWriter = getStringWriterJavaClass();
const writer = new StringWriter();
```

The local is PascalCase because it *is* a class, which is what `new StringWriter()` should read
like. Where that name is already bound in the file — `DocumentPart` and `DocumentReference` each
also name a TypeScript type — prefix the local with `Java` rather than shadowing the binding:
`const JavaDocumentReference = getDocumentReferenceJavaClass()`. Shadowing `DocumentReference`
would silently point a later `DocumentReference.fromString(...)` at the Java class.

Statics need no local at all: call the accessor directly, as in
`getLocaleJavaClass().getDefault()`.

## Runtime code

Two things here emit JavaScript while the rest of the directory does not: the type guards
(`isJavaList`, `isJavaThrowable`, …) and `Java`, which captures the injected global. Both live next
to the type they belong to — a guard next to the type it narrows, `Java` next to `JavaInterop`.
Separating either from its type makes both harder to keep correct.

`Java` must stay a `const` holding the global, never a function returning it. Scripts are evaluated
as ES modules (`application/javascript+module`, see `ScriptEvaluator`), so the binding stays
module-scoped. esbuild emits it as a top-level `var` in the bundle: were a host ever to parse that
as a script, the `var` would write through to `globalThis.Java` — harmless when writing back the
captured value, but a function would replace the interop object and break every `Java.type(...)`
call.

Because the capture happens once, a test that needs a different `Java` mocks this directory's
barrel (`graaljs-compat-typings/index.js`), not `globalThis` — see
`src/test/graaljs-barrel-mock.ts`.

**Never move a `declare global` block into a file this directory's barrel re-exports.** Nothing
imports `graaljs-injected-globals.d.ts`, so its global augmentations stay inside this package. A
`declare global` in a barrel-reachable file such as `JavaInterop.ts` reaches every consumer's
global scope through the published entry points, which would type `Java` as available in a
scripter's editor and offer it in autocomplete.

## Completeness

These declarations are hand-written and cover the members Business Scripting calls, plus the
members needed to describe those calls. They are part of the published type surface — `DocumentV2`
and everything reachable from it show up in a scripter's editor — so a declaration must not claim a
Java class has fewer members than it does. Delete a whole type that is not needed; never trim
members off one that is.
