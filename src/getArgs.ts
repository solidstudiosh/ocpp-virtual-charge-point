export function getArgs(): Record<string, any> {
    return process.argv
        .slice(2)
        .map(arg => arg.split('='))
        .reduce((args: Record<any, any>, [value, key]) => {
            args[value] = key;
            return args;
        }, {});
}
