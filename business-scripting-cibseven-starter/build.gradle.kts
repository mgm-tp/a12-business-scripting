plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.kotlin.plugin.spring)
}

dependencies {
    implementation(project(":business-scripting-rpc-facade"))
    implementation(project(":business-scripting-shared-config"))
    implementation(project(":business-scripting-shared-constants"))
    implementation(project(":business-scripting-shared-functions"))
    implementation(project(":business-scripting-shared-invoker"))
    api(project(":business-scripting-shared-script-processing"))
    implementation(project(":business-scripting-debugging-extension"))

    // Spring
    kapt(libs.spring.boot.config.processor)

    // A12 Data Services
    implementation(libs.a12.dataservices.client.autoconfig)

    // A12 Kernel
    implementation(libs.a12.kernel.md.facade)

    implementation(libs.polyglot)
    implementation(libs.polyglot.js.community)

    implementation(libs.cibseven.engine)

    // Test dependencies
    testImplementation(libs.bundles.testingCatalog.unittest)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
