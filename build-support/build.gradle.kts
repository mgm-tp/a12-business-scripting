plugins {
    alias(libs.plugins.kotlin.jvm)
    id("java-gradle-plugin")
    id("java-library")
}

dependencies {
    gradleApi()
    implementation(libs.gradleBuild.kotlin.plugin)
    implementation(libs.gradleBuild.kotlinter.plugin)

    testImplementation(libs.bundles.testingCatalog.unittest)
    testImplementation(gradleTestKit())
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}

tasks.test {
    useJUnitPlatform()
}

gradlePlugin {
    plugins {
        create("kotlinConventionsPlugin") {
            id = "com.mgmtp.a12.scripting.conventions.kotlin"
            implementationClass = "com.mgmtp.a12.scripting.gradle.plugins.conventions.kotlin.KotlinConventionsPlugin"
        }
        create("npmConventionsPlugin") {
            id = "com.mgmtp.a12.scripting.conventions.npm"
            implementationClass = "com.mgmtp.a12.scripting.gradle.plugins.conventions.npm.NpmConventionsPlugin"
        }
        create("licensePlugin") {
            id = "com.mgmtp.a12.scripting.license"
            implementationClass = "com.mgmtp.a12.scripting.gradle.plugins.license.LicensePlugin"
        }
    }
}
