import { PartialType } from '@nestjs/mapped-types';
import { CreateAutomationDto } from './create-automation.dto';

// By extending PartialType(CreateAutomationDto), all properties 
// from CreateAutomationDto become optional in UpdateAutomationDto.
// We can add specific overrides here if needed, but for a standard
// partial update, this is often sufficient.
export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {} 