plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

rootProject.name = "business-scripting"

// Builds the convention plugins every module applies.
includeBuild("build-support")

include(
    "business-scripting-core",
    "business-scripting-devtools",
    "business-scripting-eslint-config",
    "business-scripting-cibseven-starter",
    "business-scripting-dataservices-starter",
    "business-scripting-rpc-facade",
    "business-scripting-shared-config",
    "business-scripting-shared-constants",
    "business-scripting-shared-functions",
    "business-scripting-shared-invoker",
    "business-scripting-shared-script-processing",
    "business-scripting-debugging-extension",
)
