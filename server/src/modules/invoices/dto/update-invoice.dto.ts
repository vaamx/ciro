import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateInvoiceDto } from './create-invoice.dto';

// Omit billingPeriodId from updates as it shouldn't be changed after creation
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['billingPeriodId'] as const)
) {} 