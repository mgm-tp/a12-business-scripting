function execute(input) {
    return { greeting: "Hello, " + input.name };
}
execute.__paramTypes = {"name":"string"};
execute.__returnProperties = {"greeting":"string"};

export { execute };
