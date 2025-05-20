import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../core/database/prisma-types';

/**
 * Custom decorator to extract the user object attached to the request by AuthGuards.
 */
export const GetUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Omit<User, 'password_hash'> => {
    const request = ctx.switchToHttp().getRequest();
    // The user object is attached by the Passport strategy's validate method
    return request.user;
  },
); 