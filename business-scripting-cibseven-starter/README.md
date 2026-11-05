# business-scripting-cibseven-starter

Enables A12 Business Scripting in a CIB 7 application. Every script below the configured script
locations is registered as a delegate, so that a BPMN service task can call it by name. Document
operations a script performs are issued as RPC calls to A12 Data Services.

Full documentation is available at [GetA12](https://geta12.com/#/docs).

## Installation

Add the starter to your Gradle build:

```kotlin
implementation("com.mgmtp.a12.scripting:business-scripting-cibseven-starter:<version>")
```

Its beans are found by component scanning, so add `com.mgmtp.a12.scripting` to your application's
scanned packages — without it, no script is registered:

```kotlin
@SpringBootApplication(scanBasePackages = ["com.example.myapp", "com.mgmtp.a12.scripting"])
```

## Configuration

`mgmtp.a12.scripting.script-locations` is required and names the directories holding your built
scripts. A location is a directory, written as `file:` followed by a file system path or as
`classpath:` followed by a path inside the application; several are given as a comma-separated
list.

```properties
mgmtp.a12.scripting.script-locations=file:${user.dir}/scripts/build
```

The remaining `mgmtp.a12.scripting.*` settings — auto-registration, auto-loading, hot reload, chunk
name prefixes and error message handling — are documented in the developer guide.

## Development

Build and test this module with the Gradle wrapper from the repository root:

```sh
./gradlew :business-scripting-cibseven-starter:build
```
