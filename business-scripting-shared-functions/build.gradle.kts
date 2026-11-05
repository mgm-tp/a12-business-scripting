plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
}

dependencies {
    api(libs.slf4j.api)

    implementation(libs.polyglot)

    testImplementation(libs.bundles.testingCatalog.unittest)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
