import 'server-only';
import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

// Re-export from @boardsesh/db with server-only protection
export { createDb as getDb, createPool as getPool, createNeonHttp } from '@boardsesh/db/client';
export { configureNeonForEnvironment, getConnectionConfig, isDirectConnection } from '@boardsesh/db/client';

// Configure and export the raw SQL template literal function
import { configureNeonForEnvironment, getConnectionConfig, isDirectConnection } from '@boardsesh/db/client';

// Configure Neon for the environment (only needed for Neon connections)
if (!isDirectConnection()) {
  configureNeonForEnvironment();
}
const { connectionString } = getConnectionConfig();

// Export the SQL template literal function for raw SQL queries
// Both neon() and postgres() support tagged template literal syntax
export const sql = isDirectConnection()
  ? postgres(connectionString)
  : neon(connectionString);

// For backward compatibility (some code may use dbz)
import { createNeonHttp } from '@boardsesh/db/client';
export const dbz = createNeonHttp();
