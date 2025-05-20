import { Organization } from './organization.entity';

// @Entity('categories')  // Removed TypeORM decorator
// @Index(['organization', 'name'], { unique: true }) // Removed TypeORM decorator
export class Category {
    // @PrimaryGeneratedColumn() // Removed TypeORM decorator
    id!: number;

    // @Column({ length: 100 }) // Removed TypeORM decorator
    name!: string;

    // @Column({ type: 'text', nullable: true }) // Removed TypeORM decorator
    description?: string | null;

    // @Column({ name: 'organization_id' }) // Removed TypeORM decorator
    organizationId!: number;

    // @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' }) // Removed TypeORM decorator
    createdAt!: Date;

    // @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' }) // Removed TypeORM decorator
    updatedAt!: Date;

    // --- Relationships --- //

    // @ManyToOne(() => Organization, (organization) => organization.categories, { // Removed TypeORM decorator
    //     onDelete: 'CASCADE', // Delete category if organization is deleted
    //     nullable: false 
    // })
    // @JoinColumn({ name: 'organization_id' }) // Removed TypeORM decorator
    organization!: Organization;

    // TODO: Add relationship to other entities that use categories (e.g., Items, Documents)
    // @OneToMany(() => Item, item => item.category)
    // items!: Item[];
} 