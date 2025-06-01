import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if user already exists
    console.log('Checking if test user exists...');
    const existingUser = await prisma.users.findUnique({
      where: { email: 'test@example.com' }
    });

    if (existingUser) {
      console.log('Test user already exists:', existingUser);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create test user
    console.log('Creating test user...');
    const user = await prisma.users.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        hashed_password: hashedPassword,
        role: Role.USER,
        updated_at: new Date(),
      }
    });

    console.log('Test user created successfully:', user);

    // Create a test organization
    console.log('Creating test organization...');
    const organization = await prisma.organizations.create({
      data: {
        name: 'Test Organization',
        updated_at: new Date(),
      }
    });

    console.log('Test organization created:', organization);

    // Add user to organization
    console.log('Adding user to organization...');
    const membership = await prisma.organization_members.create({
      data: {
        user_id: user.id,
        organization_id: organization.id,
      }
    });

    console.log('Membership created:', membership);

    // Check if admin user exists
    const adminUser = await prisma.users.findUnique({
      where: { email: 'admin@example.com' }
    });

    if (!adminUser) {
      console.log('Creating admin user...');
      const adminHashedPassword = await bcrypt.hash('admin123', 10);
      const admin = await prisma.users.create({
        data: {
          email: 'admin@example.com',
          name: 'Admin User',
          hashed_password: adminHashedPassword,
          role: Role.ADMIN,
          updated_at: new Date(),
        }
      });

      // Add admin to organization
      const adminMembership = await prisma.organization_members.create({
        data: {
          user_id: admin.id,
          organization_id: organization.id,
        }
      });

      console.log('Admin user and membership created:', { admin, adminMembership });
    }

    // Get organization details
    const orgWithMembers = await prisma.organizations.findUnique({
      where: { id: organization.id },
      include: {
        organization_members: {
          include: {
            users: true
          }
        }
      }
    });

    console.log('Organization with members:', JSON.stringify(orgWithMembers, null, 2));

    // Check for existing organization by name
    const existingOrg = await prisma.organizations.findFirst({
      where: { name: 'Development Organization' }
    });

    if (!existingOrg) {
      console.log('Creating development organization...');
      const devOrg = await prisma.organizations.create({
        data: {
          name: 'Development Organization',
          updated_at: new Date(),
        }
      });
      console.log('Development organization created:', devOrg);
    }

  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser(); 