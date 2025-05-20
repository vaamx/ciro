import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

// The supported OAuth providers
export enum OAuthProvider {
  HUBSPOT = 'hubspot',
  // Add more providers as needed
}

export class TokenExchangeDto {
  @IsNotEmpty()
  @IsString()
  readonly code!: string;

  @IsNotEmpty()
  @IsEnum(OAuthProvider)
  readonly provider!: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  readonly redirectUri!: string;
} 