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
      return;
    }
    
    // Create test user
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);
    
    const newUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        hashedPassword,
        role: Role.ADMIN,
      }
    });
    
    console.log(`Test user created successfully: ${newUser.email} (ID: ${newUser.id})`);
    
    // Create a second test user
    const secondUser = await prisma.user.create({
      data: {
        email: 'test@ciroai.us',
        name: 'Ciro Test',
        hashedPassword,
        role: Role.USER,
      }
    });
    
    console.log(`Second test user created successfully: ${secondUser.email} (ID: ${secondUser.id})`);
    
  } catch (error) {
    console.error('Error creating test user:', error);
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