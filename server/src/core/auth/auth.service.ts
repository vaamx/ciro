import { Injectable, UnauthorizedException, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt'; // Import JwtService
import { JwtPayload } from './jwt.strategy'; // Restoring original import path for JwtPayload
import { RegisterDto } from './dto/register.dto'; // Correct import path
import { LoginDto } from './dto/login.dto'; // Correct import path
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email/email.service';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service'; // Changed from @core/database/prisma.service
import { Role } from '@prisma/client';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a random token for email verification or password reset
   * @returns A random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  async register(registerDto: RegisterDto): Promise<any> {
    const { username, email, password } = registerDto;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: registerDto.email },
          // Add other unique fields if necessary, e.g., username if you have one
          // { username: registerDto.username } 
        ],
      },
    });

    if (existingUser) {
      this.logger.warn(`Registration attempt with existing email: ${registerDto.email}`);
      throw new ConflictException('Email already exists');
    }

    // Create and save the new user
    const verificationToken = this.generateToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const newUser = this.prisma.user.create({
      data: {
        name: username,
        email,
        hashedPassword: hashedPassword,
        // email_verification_token: verificationToken, // Field not in current schema
        // email_verification_token_expires_at: tokenExpiresAt, // Field not in current schema
        // email_verified: false, // Field not in current schema
        role: Role.USER,
      },
    });

    try {
      const savedUser = await newUser;
      
      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(email, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't expose email sending failure to client
      }
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashedPassword, ...result } = savedUser as any; // Remove password before returning
      return result;
    } catch (error) {
      console.error("Registration Error:", error);
      // Handle potential unique constraint errors etc.
      throw new InternalServerErrorException('Could not register user');
    }
  }

  /**
   * Validates user credentials.
   * @param email User email
   * @param pass Plain text password
   * @returns User object without password hash if valid, otherwise null
   */
  async validateUser(email: string, pass: string): Promise<any | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { name: email }, // Assuming first_name is used as username
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        hashedPassword: true,
        // email_verified: true, // Field not in current schema
        // organization_id: true, // Field not in current schema
        role: true,
        createdAt: true, // Example
      },
    });
    
    if (!user) return null;
    
    // Validate password
    if (!user.hashedPassword) {
      this.logger.warn(`Login attempt for user without password: ${email}`);
      return null;
    }
    const isPasswordValid = await bcrypt.compare(pass, user.hashedPassword);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for user: ${email}`);
      return null;
    }
    
    // Check if email is verified (if applicable and field exists)
    // if (!user.email_verified) { // Field not in current schema, commented out
    //   // Return user with special flag to handle unverified users
    //   const { hashedPassword, ...result } = user;
    //   return { ...result, emailVerified: false };
    // }
    
    // Return user object without the password hash
    const { hashedPassword, ...result } = user;
    this.logger.verbose(`User validation successful for: ${email}`);
    return result;
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string /* TODO: Add refreshToken later */ }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    if (user.emailVerified === false) {
      throw new UnauthorizedException('Email not verified. Please check your inbox for the verification email.');
    }

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    
    // TODO: Implement refresh token strategy
    // const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' }); 

    return {
      accessToken,
      // refreshToken,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is missing');
    }

    // Find user by the verification token
    const user = await this.prisma.user.findFirst({
      // where: { email_verification_token: token }, // Field not in current schema, commented out
      where: { id: parseInt(token) } // Placeholder - NEED TOKEN FIELD!
    });

    // if (!user || !user.email_verification_token_expires_at || user.email_verification_token_expires_at < new Date()) { // Fields not in current schema
    if (!user) { // Simplified check as token/expiry fields don't exist
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user to verified status
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        // email_verified: true, // Field not in current schema
        // email_verification_token: null, // Field not in current schema
        // email_verification_token_expires_at: null, // Field not in current schema
      }
    });
    
    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(updatedUser.email, updatedUser.name || updatedUser.email);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
    
    return { message: 'Email verified successfully' };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.user.findFirst({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      console.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If your email is registered, you will receive a password reset link.' };
    }

    // Generate and save reset token
    const resetToken = this.generateToken();
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // For password reset, we'll use an alternative approach since the fields may not exist in Prisma schema
    try {
      // Use prisma.$executeRaw to run a SQL update
      await this.prisma.$executeRaw`
        UPDATE users 
        SET 
          settings = jsonb_set(
            COALESCE(settings, '{}'::jsonb), 
            '{passwordReset}', 
            jsonb_build_object('token', ${resetToken}, 'expires', ${tokenExpiresAt})::jsonb
          )
        WHERE id = ${user.id}
      `;
      
      // Send password reset email
      try {
        await this.emailService.sendPasswordResetEmail(email, resetToken);
      } catch (error) {
        console.error('Failed to send password reset email:', error);
      }
      
      return { message: 'If your email is registered, you will receive a password reset link.' };
    } catch (error) {
      console.error('Error saving password reset token:', error);
      throw new InternalServerErrorException('Failed to process password reset request');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    // Find user with the token in settings JSON field
    const users = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM users
      WHERE 
        settings->>'passwordReset' IS NOT NULL
        AND settings->'passwordReset'->>'token' = ${token}
        AND (settings->'passwordReset'->>'expires')::timestamp > NOW()
    `;

    if (!users || users.length === 0) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = users[0];

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token from settings
    await this.prisma.$executeRaw`
      UPDATE users
      SET 
        hashedPassword = ${hashedPassword},
        settings = settings - 'passwordReset'
      WHERE id = ${user.id}
    `;
    
    return { message: 'Password has been reset successfully' };
  }

  async getCurrentUser(userId: number): Promise<any> {
    this.logger.debug(`Fetching current user details for ID: ${userId}`);
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        // avatar_url: true, // Field not in current schema
        role: true,
        // organization_id: true, // Field not in current schema
        createdAt: true,
        updatedAt: true,
      }
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }
  
  async logout(userId: string): Promise<void> {
    // For now, just log the logout (JWT-based auth doesn't need server-side logout)
    console.log(`User ${userId} logged out`);
    // TODO: Implement refresh token invalidation when those are added
  }
  
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    this.logger.debug(`Attempting password change for user ID: ${userId}`);
    // Get the user with password hash
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        hashedPassword: true,
      }
    });
    
    if (!user || !user.hashedPassword) {
      this.logger.error(`Attempt to change password for non-existent user or user without password: ${userId}`);
      throw new NotFoundException('User not found or password not set.');
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the password
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedPassword: hashedPassword }
    });
    
    return { message: 'Password changed successfully' };
  }
} 