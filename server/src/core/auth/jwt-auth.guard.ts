import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * A guard that uses the default JWT strategy registered via PassportModule
 * to protect routes. It automatically handles JWT extraction and validation.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {} 