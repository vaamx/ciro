import { Organization } from './organization.entity';
// TODO: Import TeamMember entity later if needed

export class Team {
    id!: number;

    name!: string;

    description?: string | null;

    organizationId!: number;

    createdAt!: Date;

    updatedAt!: Date;

    // --- Relationships --- //

    organization!: Organization;

    // TODO: Add relationship to TeamMember entity later
    // @OneToMany(() => TeamMember, member => member.team)
    // members!: TeamMember[];
} 