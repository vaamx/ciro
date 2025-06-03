import { IsString, IsEmail, IsOptional, IsEnum, IsInt, MaxLength, MinLength } from 'class-validator';
import { CustomerStatus, BillingCycle } from '@prisma/client';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  customerNumber: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  serviceAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  meterNumber?: string;

  @IsInt()
  clientId: number;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  metadata?: any;
} 