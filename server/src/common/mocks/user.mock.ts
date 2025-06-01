import { users } from '../../core/database/prisma-types';

export const mockUser: users = {
  id: 1,
  email: 'test@example.com',
  hashed_password: 'hashed_password',
  created_at: new Date(),
  updated_at: new Date(),
  role: 'USER',
  name: 'Test User',
  // settings: null, // Removed - not part of User type
}; 