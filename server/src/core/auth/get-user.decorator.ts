import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from '../database/prisma-types';

/**
 * Custom decorator to extract the user object attached to the request by AuthGuards.
 */
export const GetUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser => {
    const request = ctx.switchToHttp().getRequest();
    // The user object is attached by the Passport strategy's validate method
    return request.user;
  },
); 