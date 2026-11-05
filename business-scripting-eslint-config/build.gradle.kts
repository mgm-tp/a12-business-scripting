plugins {
    id("com.mgmtp.a12.scripting.conventions.npm")
}

npmConventions {
    // No TypeScript sources of its own, so the ESLint flat config is the only lint input.
    lintInputFiles.set(listOf("eslint.config.mjs"))
}
