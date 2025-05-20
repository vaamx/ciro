import { Organization } from './organization.entity';
import { User } from './user.entity';

export enum OrganizationRole {
    ADMIN = 'admin',
    MEMBER = 'member',
}

export class OrganizationMember {
    id!: number;

    organization_id!: number;

    user_id!: string;

    role!: OrganizationRole;

    joined_at!: Date;

    // --- Relationships --- //

    organization!: Organization;

    user!: User;
} 