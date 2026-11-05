plugins {
    id("com.mgmtp.a12.scripting.conventions.npm")
}

npmConventions {
    testInputFiles.set(listOf("tsconfig.json", "vitest.config.ts"))
}
