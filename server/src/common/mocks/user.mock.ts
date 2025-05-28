import { User } from '../../core/database/prisma-types';

export const mockUser: User = {
  id: 1,
  email: 'test@example.com',
  hashedPassword: 'hashed_password',
  createdAt: new Date(),
  updatedAt: new Date(),
  role: 'USER',
  name: 'Test User',
  // settings: null, // Removed - not part of User type
}; 