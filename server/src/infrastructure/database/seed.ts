import { pool } from './index';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

async function seedDatabase() {
  try {
    // Create test user
    const userId = uuidv4();
    const password = 'password123';
    console.log('Seeding database with test user...');
    console.log('Test password:', password);
    
    // Hash password with specific salt rounds for consistency
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    console.log('Generated salt:', salt);
    
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Generated password hash:', hashedPassword);
    
    // Verify the hash immediately
    const verifyHash = await bcrypt.compare(password, hashedPassword);
    console.log('Immediate hash verification:', verifyHash);
    
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         email_verified = EXCLUDED.email_verified
       RETURNING id, email, password_hash`,
      [userId, 'test@example.com', hashedPassword, 'user', true]
    );

    console.log('Database seeded successfully');
    console.log('Inserted/Updated user:', result.rows[0]);
    
    // Verify the stored hash
    const storedUser = await pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['test@example.com']
    );
    
    if (storedUser.rows.length > 0) {
      const storedHash = storedUser.rows[0].password_hash;
      const verifyStoredHash = await bcrypt.compare(password, storedHash);
      console.log('Stored hash verification:', {
        stored_hash: storedHash,
        verification_result: verifyStoredHash
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase(); 