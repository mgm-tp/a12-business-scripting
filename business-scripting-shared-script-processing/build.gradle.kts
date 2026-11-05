plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.plugin.spring)
}

dependencies {
    compileOnly(libs.spring.context)
    implementation(project(":business-scripting-shared-functions"))
    implementation(project(":business-scripting-shared-config"))
    implementation(libs.a12.dataservices.domain)
    implementation(libs.polyglot)
    implementation(libs.polyglot.js.community)

    testImplementation(libs.testingCatalog.spring.boot.test)
    testImplementation(libs.bundles.testingCatalog.unittest)
    // Only for OutputCaptureExtension, which pins the warnings this module logs
    testImplementation(libs.testingCatalog.spring.boot.test)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
