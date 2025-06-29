import { FastifyReply } from 'fastify';
import {
  isBoom,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  badRequest,
  internal,
} from '@hapi/boom';
import type { AppError } from '@aces/utils';

export function boom(
  statusCode: number,
  code: string,
  message: string,
  meta?: Record<string, unknown>,
): AppError {
  return { statusCode, code, message, meta };
}

export function handleError(reply: FastifyReply, error: unknown) {
  // Handle @hapi/boom errors
  if (isBoom(error)) {
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
    const appError = error as AppError;
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
    const prismaError = error as { code: string; meta?: { target?: string[] } };
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
export const errors = {
  unauthorized: (message = 'Authentication required') => unauthorized(message),

  forbidden: (message = 'Access denied') => forbidden(message),

  notFound: (resource = 'Resource') => notFound(`${resource} not found`),

  validation: (message: string, meta?: Record<string, unknown>) =>
    boom(400, 'VALIDATION_ERROR', message, meta),

  conflict: (message: string) => conflict(message),

  badRequest: (message: string) => badRequest(message),

  internal: (message = 'Internal server error') => internal(message),
};
