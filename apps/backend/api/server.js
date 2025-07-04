"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./lib/logger");
const app_1 = require("./app");
const start = async () => {
    let app = null;
    try {
        app = await (0, app_1.buildApp)();
        // Graceful shutdown handlers
        const gracefulShutdown = (signal) => {
            logger_1.logger.info(`Received ${signal}, shutting down...`);
            if (app) {
                app.close().then(() => {
                    logger_1.logger.info('Server successfully closed.');
                    process.exit(0);
                });
            }
            else {
                process.exit(0);
            }
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
        await app.listen({ port, host: '0.0.0.0' });
        logger_1.logger.info(`Server listening at http://localhost:${port}`);
    }
    catch (err) {
        logger_1.logger.error('Error starting server:', err);
        console.error('Full error details:', err); // Additional logging for debugging
        if (app) {
            await app.close();
        }
        process.exit(1);
    }
};
start();
