import { Organization } from './organization.entity';
import { OrganizationMember } from './organization-member.entity';
import { Role } from '../../auth/role.enum';

export class User {
    id!: string;
    username?: string;
    email!: string;
    password_hash!: string;
    email_verified!: boolean;
    email_verification_token?: string;
    email_verification_token_expires_at?: Date;
    password_reset_token?: string;
    password_reset_token_expires_at?: Date;
    organization_id!: number | null;
    roles!: Role[];
    created_at!: Date;
    updated_at!: Date;

    organization?: Organization | null;
    memberships!: OrganizationMember[];
} 