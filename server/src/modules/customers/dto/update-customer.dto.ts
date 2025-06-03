import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

// Omit clientId from updates as it shouldn't be changed after creation
export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['clientId'] as const)
) {} 