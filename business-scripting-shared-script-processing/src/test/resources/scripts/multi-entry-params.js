function execute(input) {
    return { greeting: "Hello, " + input.firstName, message: "ok" };
}
execute.__paramTypes = {"firstName":"string","lastName":"string","age":"number"};
execute.__returnProperties = {"greeting":"string","message":"string"};

export { execute };
