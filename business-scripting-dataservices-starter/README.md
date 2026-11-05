# business-scripting-dataservices-starter

Enables A12 Business Scripting in an A12 Data Services application. Every script below the
configured script locations becomes a callable script, reachable through the `CALL_SCRIPT` RPC
operation. Document operations a script performs use the Data Services API directly, without a
round trip.

Full documentation is available at [GetA12](https://geta12.com/#/docs).

## Installation

Add the starter to your Gradle build:

```kotlin
implementation("com.mgmtp.a12.scripting:business-scripting-dataservices-starter:<version>")
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
mgmtp.a12.dataservices.jsonRpc.allowedOperations=CALL_SCRIPT
```

Calling a script also requires the `CALL_SCRIPT` right on the caller's role. The developer guide
shows the authorization definition to add, along with the remaining `mgmtp.a12.scripting.*`
settings for auto-registration, auto-loading, hot reload, chunk name prefixes and error message
handling.

## Development

Build and test this module with the Gradle wrapper from the repository root:

```sh
./gradlew :business-scripting-dataservices-starter:build
```
