import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateMeterReadingDto } from './create-meter-reading.dto';

// Omit customerId from updates as it shouldn't be changed after creation
export class UpdateMeterReadingDto extends PartialType(
  OmitType(CreateMeterReadingDto, ['customerId'] as const)
) {} 