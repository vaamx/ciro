import { IsInt, IsDateString, IsOptional, IsPositive } from 'class-validator';

export class CreateBillingPeriodDto {
  @IsInt()
  @IsPositive()
  customerId: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  tariffRateId?: number;
} 