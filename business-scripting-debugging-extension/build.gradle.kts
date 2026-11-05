plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.kapt)
}

dependencies {
    implementation(project(":business-scripting-shared-functions"))

    implementation(libs.spring.boot.starter)
    implementation(libs.polyglot)
    kapt(libs.spring.boot.config.processor)

    testImplementation(libs.bundles.testingCatalog.unittest)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
