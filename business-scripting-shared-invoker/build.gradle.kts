plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.plugin.spring)
}

dependencies {
    compileOnly(libs.spring.context)
    implementation(libs.polyglot)
    implementation(libs.a12.dataservices.domain)
    implementation(project(":business-scripting-shared-functions"))
    implementation(project(":business-scripting-shared-script-processing"))

    testImplementation(libs.bundles.testingCatalog.unittest)
    testImplementation(libs.polyglot.js.community)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
