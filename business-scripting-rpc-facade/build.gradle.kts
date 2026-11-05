plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.plugin.spring)
}

dependencies {
    implementation(project(":business-scripting-shared-constants"))
    implementation(project(":business-scripting-shared-functions"))

    // A12 Data Services
    implementation(libs.a12.dataservices.client.autoconfig)

    // A12 Kernel
    implementation(libs.a12.kernel.md.facade)

    // Test dependencies
    testImplementation(kotlin("test"))
    testImplementation(libs.bundles.testingCatalog.unittest)
    testImplementation(libs.testingCatalog.kotest.assertions.core)
    testImplementation(libs.testingCatalog.jackson.kotlin)
    testImplementation(libs.testingCatalog.spring.boot.test)
}
