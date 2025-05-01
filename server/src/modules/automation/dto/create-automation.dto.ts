import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength, MinLength, IsJSON } from 'class-validator';

export class CreateAutomationDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    // Assuming trigger and actions are complex objects (e.g., JSON)
    // Use more specific validation if structure is known
    @IsObject() // or @IsJSON() if it's expected as a JSON string initially?
    @IsNotEmpty()
    trigger!: Record<string, any>; // Or a more specific interface/class

    @IsObject() // or @IsJSON()?
    @IsNotEmpty()
    actions!: Record<string, any>; // Or a more specific interface/class
} 