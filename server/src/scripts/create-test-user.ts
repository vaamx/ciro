import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Checking for existing test user...');
    
    // Check if test users already exist
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'test@example.com' },
          { email: 'test@ciroai.us' }
        ]
      }
    });
    
    if (existingUser) {
      console.log(`Test user already exists: ${existingUser.email}`);
      
      // Check if organizations exist for this user
      const userOrgs = await prisma.organizationMember.findMany({
        where: { userId: existingUser.id },
        include: { organization: true }
      });
      
      if (userOrgs.length > 0) {
        console.log(`User has ${userOrgs.length} organization(s):`, userOrgs.map(om => om.organization.name));
        return;
      } else {
        console.log('User exists but has no organizations. Creating test organizations...');
      }
    }
    
    // Create test user if doesn't exist
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);
    
    let newUser, secondUser;
    
    if (!existingUser) {
      newUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          hashedPassword,
          role: Role.ADMIN,
        }
      });
      
      console.log(`Test user created successfully: ${newUser.email} (ID: ${newUser.id})`);
      
      // Create a second test user
      secondUser = await prisma.user.create({
        data: {
          email: 'test@ciroai.us',
          name: 'Ciro Test',
          hashedPassword,
          role: Role.USER,
        }
      });
      
      console.log(`Second test user created successfully: ${secondUser.email} (ID: ${secondUser.id})`);
    } else {
      newUser = existingUser;
      // Try to find the second user
      secondUser = await prisma.user.findFirst({
        where: { email: 'test@ciroai.us' }
      });
      
      if (!secondUser) {
        secondUser = await prisma.user.create({
          data: {
            email: 'test@ciroai.us',
            name: 'Ciro Test',
            hashedPassword,
            role: Role.USER,
          }
        });
        console.log(`Second test user created successfully: ${secondUser.email} (ID: ${secondUser.id})`);
      }
    }
    
    // Create test organizations
    console.log('Creating test organizations...');
    
    // Check if test organizations already exist
    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: 'Test Organization' },
          { name: 'Ciro AI' }
        ]
      }
    });
    
    let testOrg, ciroOrg;
    
    if (!existingOrg) {
      testOrg = await prisma.organization.create({
        data: {
          name: 'Test Organization',
        }
      });
      
      console.log(`Test organization created: ${testOrg.name} (ID: ${testOrg.id})`);
      
      ciroOrg = await prisma.organization.create({
        data: {
          name: 'Ciro AI',
        }
      });
      
      console.log(`Ciro organization created: ${ciroOrg.name} (ID: ${ciroOrg.id})`);
    } else {
      // Find both organizations
      const orgs = await prisma.organization.findMany({
        where: {
          OR: [
            { name: 'Test Organization' },
            { name: 'Ciro AI' }
          ]
        }
      });
      
      testOrg = orgs.find(org => org.name === 'Test Organization');
      ciroOrg = orgs.find(org => org.name === 'Ciro AI');
      
      if (!testOrg) {
        testOrg = await prisma.organization.create({
          data: {
            name: 'Test Organization',
          }
        });
        console.log(`Test organization created: ${testOrg.name} (ID: ${testOrg.id})`);
      }
      
      if (!ciroOrg) {
        ciroOrg = await prisma.organization.create({
          data: {
            name: 'Ciro AI',
          }
        });
        console.log(`Ciro organization created: ${ciroOrg.name} (ID: ${ciroOrg.id})`);
      }
    }
    
    // Assign users to organizations
    console.log('Assigning users to organizations...');
    
    // Check if memberships already exist
    const existingMembership1 = await prisma.organizationMember.findFirst({
      where: {
        userId: newUser.id,
        organizationId: testOrg.id
      }
    });
    
    if (!existingMembership1) {
      await prisma.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: testOrg.id,
        }
      });
      console.log(`Assigned ${newUser.email} to ${testOrg.name}`);
    } else {
      console.log(`${newUser.email} already assigned to ${testOrg.name}`);
    }
    
    const existingMembership2 = await prisma.organizationMember.findFirst({
      where: {
        userId: newUser.id,
        organizationId: ciroOrg.id
      }
    });
    
    if (!existingMembership2) {
      await prisma.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: ciroOrg.id,
        }
      });
      console.log(`Assigned ${newUser.email} to ${ciroOrg.name}`);
    } else {
      console.log(`${newUser.email} already assigned to ${ciroOrg.name}`);
    }
    
    const existingMembership3 = await prisma.organizationMember.findFirst({
      where: {
        userId: secondUser.id,
        organizationId: ciroOrg.id
      }
    });
    
    if (!existingMembership3) {
      await prisma.organizationMember.create({
        data: {
          userId: secondUser.id,
          organizationId: ciroOrg.id,
        }
      });
      console.log(`Assigned ${secondUser.email} to ${ciroOrg.name}`);
    } else {
      console.log(`${secondUser.email} already assigned to ${ciroOrg.name}`);
    }
    
    console.log('Test data setup completed successfully!');
    
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser()
  .then(() => console.log('Done!'))
  .catch(e => {
    console.error(e);
    process.exit(1);
  }); 