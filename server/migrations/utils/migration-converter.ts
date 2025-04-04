import * as fs from 'fs';
import * as path from 'path';

// Update path to point to the parent directory since we're now in utils subdirectory
const MIGRATIONS_DIR = path.resolve(__dirname, '../');

// Get all JS migration files
const jsFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.js') && !file.endsWith('.d.js'));

console.log(`Found ${jsFiles.length} JavaScript migration files to convert`);

jsFiles.forEach(jsFile => {
  const filePath = path.join(MIGRATIONS_DIR, jsFile);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Transform CommonJS to ES Module syntax
  let tsContent = content;

  // Check if there's a JSDoc comment at the beginning
  if (tsContent.trim().startsWith('/**')) {
    // Replace JSDoc comment with import
    tsContent = tsContent.replace(/\/\*\*[\s\S]*?\*\//, `import { Knex } from 'knex';`);
  } else {
    // Add import at the beginning if no JSDoc
    tsContent = `import { Knex } from 'knex';\n\n${tsContent}`;
  }

  // Replace async exports.up
  tsContent = tsContent.replace(
    /exports\.up\s*=\s*async\s*function\s*\(\s*knex\s*\)\s*{/, 
    `export async function up(knex: Knex): Promise<void> {`
  );
  
  // Replace non-async exports.up
  tsContent = tsContent.replace(
    /exports\.up\s*=\s*function\s*\(\s*knex\s*\)\s*{/, 
    `export function up(knex: Knex): Promise<void> {`
  );
  
  // Replace async exports.down
  tsContent = tsContent.replace(
    /exports\.down\s*=\s*async\s*function\s*\(\s*knex\s*\)\s*{/, 
    `export async function down(knex: Knex): Promise<void> {`
  );

  // Replace non-async exports.down
  tsContent = tsContent.replace(
    /exports\.down\s*=\s*function\s*\(\s*knex\s*\)\s*{/, 
    `export function down(knex: Knex): Promise<void> {`
  );
  
  // Create new TS file with the same name
  const tsFile = jsFile.replace('.js', '.ts');
  const tsPath = path.join(MIGRATIONS_DIR, tsFile);
  
  fs.writeFileSync(tsPath, tsContent);
  console.log(`✓ Converted ${jsFile} to ${tsFile}`);
}); 