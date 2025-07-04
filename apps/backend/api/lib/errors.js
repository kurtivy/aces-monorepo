"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errors = void 0;
exports.boom = boom;
exports.handleError = handleError;
const boom_1 = require("@hapi/boom");
function boom(statusCode, code, message, meta) {
    return { statusCode, code, message, meta };
}
function handleError(reply, error) {
    // Handle @hapi/boom errors
    if ((0, boom_1.isBoom)(error)) {
        return reply.status(error.output.statusCode).send({
            error: {
                code: error.message.toUpperCase().replace(/\s+/g, '_'),
                message: error.message,
                meta: error.data,
            },
        });
    }
    // Handle our custom AppError format
    if (error && typeof error === 'object' && 'statusCode' in error) {
        const appError = error;
        return reply.status(appError.statusCode).send({
            error: {
                code: appError.code,
                message: appError.message,
                meta: appError.meta,
            },
        });
    }
    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error;
        if (prismaError.code === 'P2002') {
            return reply.status(409).send({
                error: {
                    code: 'CONFLICT',
                    message: 'Resource already exists',
                    meta: { constraint: prismaError.meta?.target },
                },
            });
        }
    }
    // Unexpected error
    reply.log.error(error);
    return reply.status(500).send({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
    });
}
// Common error factories using @hapi/boom
exports.errors = {
    unauthorized: (message = 'Authentication required') => (0, boom_1.unauthorized)(message),
    forbidden: (message = 'Access denied') => (0, boom_1.forbidden)(message),
    notFound: (resource = 'Resource') => (0, boom_1.notFound)(`${resource} not found`),
    validation: (message, meta) => boom(400, 'VALIDATION_ERROR', message, meta),
    conflict: (message) => (0, boom_1.conflict)(message),
    badRequest: (message) => (0, boom_1.badRequest)(message),
    internal: (message = 'Internal server error') => (0, boom_1.internal)(message),
};
