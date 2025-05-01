import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

// Define the structure of the JWT payload
export interface JwtPayload {
  userId: string;
  email: string; // Optional: Include other non-sensitive user identifiers
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      // Throw an error during initialization if the secret is missing
      throw new InternalServerErrorException('JWT_SECRET is not defined in environment variables.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, // Use the validated secret
    });
  }

  /**
   * This method is called by Passport after verifying the JWT signature and expiration.
   * It receives the decoded payload and should return the user object or throw an error.
   */
  async validate(payload: JwtPayload): Promise<any> {
    // console.log('JWT Strategy Validate Payload:', payload); // Log received payload

    if (!payload || !payload.userId) {
      // console.log('JWT Strategy: Invalid payload or missing user ID.');
      throw new UnauthorizedException('Invalid token payload');
    }

    // Use payload.userId
    const userId = payload.userId; 

    // Validate the user exists in the database
    // console.log(`JWT Strategy: Validating user ID from payload: ${userId}`);
    const user = await this.prisma.user.findUnique({ // Changed users to user
      where: { id: parseInt(userId as any, 10) }, // Explicitly parse userId to number
      // Select only necessary fields to attach to request.user
      select: {
        id: true,
        email: true,
        name: true, // Use name field from schema
        role: true,
        // Add other fields if needed by your application logic
      }
    });

    if (!user) {
      // console.log(`JWT Strategy: User ID ${userId} not found in database.`);
      throw new UnauthorizedException('User not found or token invalid');
    }
    
    // Return the user object (already without password_hash due to select)
    return user;
  }
} 