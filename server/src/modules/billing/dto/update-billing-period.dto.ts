import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateBillingPeriodDto } from './create-billing-period.dto';

// Omit customerId from updates as it shouldn't be changed after creation
export class UpdateBillingPeriodDto extends PartialType(
  OmitType(CreateBillingPeriodDto, ['customerId'] as const)
) {} 