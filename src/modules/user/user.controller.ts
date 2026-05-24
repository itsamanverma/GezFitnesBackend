import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service.js';
import { UpdateUserSchema } from './user.schema.js';
import { success } from '../../utils/response.js';
import { ValidationError } from '../../utils/errors.js';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.getUserById(req.user.id);
    return success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.format());
    }

    const user = await userService.updateUser(req.user.id, parsed.data);
    return success(res, user, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteMe(req: Request, res: Response, next: NextFunction) {
  try {
    await userService.deleteUser(req.user.id);
    // Clear the better-auth session cookie
    res.clearCookie('better-auth.session_token');
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}
