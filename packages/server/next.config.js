const path = require('path');

module.exports = {
    webpack: (config, { isServer, nextRuntime }) => {
        if (isServer && nextRuntime !== 'edge') {
            return {
                ...config,
                entry() {
                    return config.entry().then((entry) => ({
                        ...entry,
                        // adding custom entry points
                        cli: path.resolve(process.cwd(), 'src/cli.ts'),
                    }));
                }
            };
        }
        return config;
    },
};
