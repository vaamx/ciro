import { IsString, IsEmail, IsOptional, IsEnum, IsInt, IsPositive, IsBoolean } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateSystemUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsInt()
  @IsPositive()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  isSystemAdmin?: boolean;
}

export class UpdateSystemUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystemAdmin?: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  organizationId?: number;
}

export class UserSearchDto {
  @IsOptional()
  @IsString()
  query?: string; // Search by name or email

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsInt()
  @IsPositive()
  organizationId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystemAdmin?: boolean;
}

export class SystemUserResponseDto {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  isSystemAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  
  organization?: {
    id: number;
    name: string;
    status?: string;
  };
  
  organizationMemberships?: Array<{
    organizationId: number;
    organizationName: string;
    role: Role;
    joinedAt: string;
  }>;
  
  // Usage statistics
  loginCount: number;
  lastActivity?: string;
}

export class BulkUserActionDto {
  @IsInt({ each: true })
  @IsPositive({ each: true })
  userIds: number[];

  @IsString()
  action: 'activate' | 'deactivate' | 'delete' | 'reset_password';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkUserActionResultDto {
  userId: number;
  userName: string;
  userEmail: string;
  success: boolean;
  action: string;
  error?: string;
  performedAt: string;
} 