import {
  Boom,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  badRequest,
  internal,
} from '@hapi/boom';
import { FastifyReply } from 'fastify';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Helper to check if something is a FastifyReply
function isFastifyReply(obj: unknown): obj is FastifyReply {
  if (obj === null || typeof obj !== 'object') return false;

  const candidate = obj as { status?: unknown; send?: unknown };
  return typeof candidate.status === 'function' && typeof candidate.send === 'function';
}

export async function handleError(error: unknown, reply: FastifyReply): Promise<void> {
  if (error instanceof AppError) {
    await reply.status(400).send({
      error: error.code,
      message: error.message,
      meta: error.meta,
    });
    return;
  }

  if (error instanceof Boom) {
    await reply.status(error.output.statusCode).send(error.output.payload);
    return;
  }

  // Default to internal server error
  const internalError = internal('An unexpected error occurred');
  await reply.status(internalError.output.statusCode).send(internalError.output.payload);
}

// Backward compatibility wrapper
export async function handleErrorLegacy(
  replyOrError: FastifyReply | unknown,
  errorOrReply: unknown | FastifyReply,
): Promise<void> {
  if (isFastifyReply(replyOrError)) {
    // Old style: handleError(reply, error)
    return handleError(errorOrReply, replyOrError);
  } else {
    // New style: handleError(error, reply)
    if (!isFastifyReply(errorOrReply)) {
      throw new Error('Invalid arguments to handleError');
    }
    return handleError(replyOrError, errorOrReply);
  }
}

export const errors = {
  unauthorized: (message?: string) => unauthorized(message || 'Unauthorized'),
  forbidden: (message?: string) => forbidden(message || 'Forbidden'),
  notFound: (resource?: string) => notFound(resource ? `${resource} not found` : 'Not found'),
  validation: (message: string, meta?: Record<string, unknown>) =>
    new AppError(message, 'VALIDATION_ERROR', meta),
  conflict: (message: string) => conflict(message),
  badRequest: (message: string) => badRequest(message),
  tooManyRequests: (message: string) => new Boom(message, { statusCode: 429 }),
  internal: (message: string, { cause }: { cause?: unknown } = {}) => {
    const error = internal(message);
    if (cause) error.data = { cause };
    return error;
  },
};
