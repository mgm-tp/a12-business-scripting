plugins {
    id("com.mgmtp.a12.scripting.conventions.kotlin")
    alias(libs.plugins.kotlin.plugin.spring)
}

dependencies {
    implementation(project(":business-scripting-shared-constants"))
    implementation(project(":business-scripting-shared-config"))
    implementation(project(":business-scripting-shared-functions"))
    implementation(project(":business-scripting-shared-invoker"))
    api(project(":business-scripting-shared-script-processing"))
    implementation(project(":business-scripting-debugging-extension"))

    // A12 Data Services
    implementation(libs.a12.dataservices.core.autoconfig)

    // Data Services manages Liquibase 4.33.0, but the Spring Boot BOM it drags in manages a 5.x
    // version that Gradle's conflict resolution prefers -- and Liquibase 5 changed its license
    // model. The catalog declares the version as 'strictly' to force the downgrade.
    //
    // The constraint sits on the resolvable configurations instead of on 'implementation' so it is
    // not published: a strict version only wins for the module that declares it. A consumer that
    // inherited it from this starter's metadata would instead fail to resolve Liquibase at all, as
    // soon as anything else on its classpath pulls 5.x. Consumers have to declare the pin
    // themselves until Data Services declares it 'strictly' in dataservices-parent.
    constraints {
        compileClasspath(libs.liquibase.core)
        runtimeClasspath(libs.liquibase.core)
        testCompileClasspath(libs.liquibase.core)
        testRuntimeClasspath(libs.liquibase.core)
    }

    implementation(libs.polyglot)
    implementation(libs.polyglot.js.community)

    // Test dependencies
    testImplementation(libs.bundles.testingCatalog.unittest)
    testImplementation(libs.testingCatalog.spring.boot.test)
    testRuntimeOnly(libs.testingCatalog.junit.jupiter.launcher)
}
