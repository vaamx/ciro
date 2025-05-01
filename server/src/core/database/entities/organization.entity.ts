import { OrganizationMember } from './organization-member.entity';
import { User } from './user.entity'; // Assuming User entity exists
import { Team } from './team.entity'; // Import Team entity
import { Category } from './category.entity'; // Import Category entity
// Import other related entities like Team, Category if needed

// @Entity('organizations') // Removed TypeORM decorator
export class Organization {
    // @PrimaryGeneratedColumn() // Removed TypeORM decorator
    id!: number;

    // @Column({ length: 100 }) // Removed TypeORM decorator
    name!: string;

    // @Column({ type: 'text', nullable: true }) // Removed TypeORM decorator
    description!: string | null;

    // @Column({ name: 'logo_url', type: 'varchar', length: 2048, nullable: true }) // Removed TypeORM decorator
    logo_url!: string | null;

    // @Column({ type: 'jsonb', default: {} }) // Removed TypeORM decorator
    settings!: Record<string, any>;

    // @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' }) // Removed TypeORM decorator
    created_at!: Date;

    // @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' }) // Removed TypeORM decorator
    updated_at!: Date;
    
    // @Column({ name: 'created_by', type: 'uuid', nullable: true }) // Removed TypeORM decorator
    created_by!: string | null;

    // --- Relationships --- //

    // @OneToMany(() => OrganizationMember, member => member.organization) // Removed TypeORM decorator
    members!: OrganizationMember[];

    // @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) // Removed TypeORM decorator
    // @JoinColumn({ name: 'created_by' }) // Removed TypeORM decorator
    creator?: User | null;

    // Add relationships to Team and Category
    // @OneToMany(() => Team, team => team.organization) // Removed TypeORM decorator
    teams!: Team[];

    // @OneToMany(() => Category, category => category.organization) // Removed TypeORM decorator
    categories!: Category[];

    // Add other relationships (Teams, Categories, etc.) here
    // Example:
    // @OneToMany(() => Team, team => team.organization)
    // teams: Team[];
    
     // --- Non-column property added by query --- //
    // This property is populated by loadRelationCountAndMap in the service
    memberCount?: number;
} 