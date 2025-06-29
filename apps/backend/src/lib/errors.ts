import { FastifyReply } from 'fastify';

export interface AppError {
  statusCode: number;
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export function boom(
  statusCode: number,
  code: string,
  message: string,
  meta?: Record<string, unknown>,
): AppError {
  return { statusCode, code, message, meta };
}

export function handleError(reply: FastifyReply, error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const appError = error as AppError;
    return reply.status(appError.statusCode).send({
      error: {
        code: appError.code,
        message: appError.message,
        meta: appError.meta,
      },
    });
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

// Common error factories
export const errors = {
  unauthorized: (message = 'Authentication required') => boom(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'Access denied') => boom(403, 'FORBIDDEN', message),

  notFound: (resource = 'Resource') => boom(404, 'NOT_FOUND', `${resource} not found`),

  validation: (message: string, meta?: Record<string, unknown>) =>
    boom(400, 'VALIDATION_ERROR', message, meta),

  conflict: (message: string) => boom(409, 'CONFLICT', message),

  badRequest: (message: string) => boom(400, 'BAD_REQUEST', message),
};
