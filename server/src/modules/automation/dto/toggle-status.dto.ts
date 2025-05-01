import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleStatusDto {
    @IsBoolean()
    @IsNotEmpty()
    active!: boolean;
} 