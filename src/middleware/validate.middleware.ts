import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { error as errorResponse } from '../utils/response.js';

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Invalid request data', 400, error.issues);
      }
      next(error);
    }
  };
};
