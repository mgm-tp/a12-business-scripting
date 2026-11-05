import com.mgmtp.a12.scripting.gradle.plugins.license.CommentStyle

plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.kapt) apply false
    alias(libs.plugins.kotlin.plugin.spring) apply false
    alias(libs.plugins.kotlinter)
    id("com.mgmtp.a12.scripting.license")
}

// build-support is consumed as an included build (see settings.gradle.kts), so it cannot apply
// its own license plugin to itself (Gradle disallows an included build applying a plugin it
// provides to its own sources). Scan it from here instead so its .kt/.groovy sources are still
// covered by the copyright header.
licenseHeaders {
    headerFile.set(rootProject.file("license_header"))
    folder.set("build-support")
    rule(".kt", CommentStyle.BLOCK_COMMENT)
    rule(".groovy", CommentStyle.BLOCK_COMMENT)
}

// Each module applies its own conventions, so this file declares nothing per module. The version is
// deliberately not set here: this build derives it from git, and a source tree without git metadata
// reads it from gradle.properties instead.
allprojects {
    group = "com.mgmtp.a12.scripting"
}


