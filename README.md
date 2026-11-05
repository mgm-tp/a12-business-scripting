<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://www.mgm-tp.com/global-content/cd/logos/a12/app-icons/dark/A12-Dark.svg" />
  <img src="https://www.mgm-tp.com/global-content/cd/logos/a12/app-icons/light/A12-Light.svg" height="200" alt="A12 logo" />
</picture>

# A12 Business Scripting

Business Scripting provides a high-level API for A12 operations (documents, links, etc.) used in scripts across the A12 platform (workflows, DataServices, A12 Client). 
This version targets A12 2026.06 with CIB 7 & DS Context API.

Refer to [GetA12](https://geta12.com/#/docs) to get started with A12 development.

---

## License

Parts of the A12 platform are made available under a **dual license**.  
Please check the [LICENSE](./LICENSE) file for details.

---

## Modules

For more detailed info, see the READMEs in the respective subfolders.

* ``build-support``: Gradle convention plugins the modules below apply (Kotlin and npm setup, legal-document packaging).
* ``business-scripting-core`` (A12 Business Scripting API): Defines easy-to-use and execution context-aware TypeScript API for Business Scripting.
* ``business-scripting-cibseven-starter``: Starter for enabling A12 Business Scripting in CIB 7.
* ``business-scripting-dataservices-starter``: Starter for enabling calling scripts in Data Services.
* ``business-scripting-rpc-facade``: Facade for RPC calls to Data Services when scripts are not executed directly in DS (e.g. workflow script tasks).
* ``business-scripting-shared-config``: Shared Spring configuration for involved Spring services (Data Services and CIB 7).
* ``business-scripting-shared-constants``: Shared constants used across different modules.
* ``business-scripting-shared-functions``: Shared functions used across different modules.
* ``business-scripting-shared-invoker``: Shared script invoker used by both CIB 7 and DataServices modules.
* ``business-scripting-shared-script-processing``: Shared script evaluation and context infrastructure (ScriptEvaluator, BaseContext).
* ``business-scripting-debugging-extension``: Extension module for enabling shared GraalJS engine with debugging options for CIB 7 and DataServices.
* ``business-scripting-devtools``: Build tooling (esbuild integration, script metadata) for Business Scripting consumers.
* ``business-scripting-eslint-config``: ESLint config for A12 Business Scripting authors (scripters).

---

## Getting Started

### How to Use It

#### Import & Install

Add ``business-scripting-core`` as a npm dependency to use the Business Scripting API to the dependency manager in the 
directory containing your business scripts
Add the ``business-scripting-cibseven-starter`` and/or ``business-scripting-dataservices-starter`` Gradle module as a dependency
to enable Business Scripting in a CIB 7 or Data Services application, respectively.

---

### How to Build

#### Prerequisites (tools and their versions)
| Software | Version    |
|----------|------------|
| Java     | \>= 21.0.0 |
| Gradle   | \>= 9.0.0  | 
| Node.js  | \>= 24.0.0 | 
| Npm      | \>= 11.0.0 |

#### Registry Setup

This project depends on A12 artifacts, which are distributed through GetA12 and require a
[GetA12](https://geta12.com) account. The npm packages are served from
``https://artifacts.geta12.com/artifactory/api/npm/a12-npm/``; configure that registry for the
``@com.mgmtp.a12.*`` scopes in your ``.npmrc`` before running ``npm install``.

#### Building and Testing

Build and test the Kotlin modules with the Gradle wrapper:

    ./gradlew build
    ./gradlew check

Each npm module (``business-scripting-core``, ``business-scripting-devtools``,
``business-scripting-eslint-config``) provides the same scripts:

| Command            | Purpose                                       |
|--------------------|-----------------------------------------------|
| ``npm run compile``| Compile the TypeScript sources into ``dist/`` |
| ``npm run lint``   | Report lint violations                        |
| ``npm run format`` | Fix the lint violations that can be fixed     |
| ``npm run test``   | Run the tests                                 |
| ``npm run clean``  | Delete the compiled output                    |

---

### Documentation

- Full technical documentation is available at [GetA12.com](https://GetA12.com).  
- The website also provides access to the **A12 Discourse Community Forum**.

---

**The mgm A12 Team**

[mgm technology partners GmbH](https://www.mgm-tp.com) | [Imprint](https://www.mgm-tp.com/imprint.html)
