plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.kotlin.plugin.spring)
}

dependencies {
    implementation(project(":business-scripting-shared-functions"))
    implementation(libs.spring.boot.starter)
    // Constructor binding of the Kotlin ScriptingProperties class requires kotlin-reflect at application runtime
    runtimeOnly(libs.kotlin.reflect)
    kapt(libs.spring.boot.config.processor)

    // Test dependencies
    testImplementation(libs.bundles.testingCatalog.unittest)
    testImplementation(libs.testingCatalog.awaitility)
    testImplementation(libs.testingCatalog.spring.boot.test)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
