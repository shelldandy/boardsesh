import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import postgres from 'postgres';
import ws from 'ws';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment files (same as drizzle.config.ts)
config({ path: path.resolve(__dirname, '../../../.env.local') });
config({ path: path.resolve(__dirname, '../../web/.env.local') });
config({ path: path.resolve(__dirname, '../../web/.env.development.local') });

// Enable WebSocket for Neon
neonConfig.webSocketConstructor = ws;

// Configure Neon for local development (uses neon-proxy on port 4444)
function configureNeonForLocal(connectionString: string): void {
  const connectionStringUrl = new URL(connectionString);
  const isLocalDb = connectionStringUrl.hostname === 'db.localtest.me';

  if (isLocalDb) {
    neonConfig.fetchEndpoint = (host) => {
      const [protocol, port] = host === 'db.localtest.me' ? ['http', 4444] : ['https', 443];
      return `${protocol}://${host}:${port}/sql`;
    };
    neonConfig.useSecureWebSocket = false;
    neonConfig.wsProxy = (host) => (host === 'db.localtest.me' ? `${host}:4444/v2` : `${host}/v2`);
  }
}

/**
 * Check if the connection string points to a direct PostgreSQL connection
 * (not Neon serverless, not local Neon proxy).
 */
function isDirectConnection(connectionString: string): boolean {
  const hostname = new URL(connectionString).hostname;
  if (hostname === 'db.localtest.me') return false;
  if (hostname.endsWith('.neon.tech')) return false;
  return true;
}

async function runMigrations() {
  // Check for DATABASE_URL first, then POSTGRES_URL (Vercel Neon integration)
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  // Validation: A database URL must be set
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL is not set');
    console.error('   Available env vars:', Object.keys(process.env).filter(k =>
      k.includes('DATABASE') || k.includes('POSTGRES')
    ).join(', ') || 'none');
    process.exit(1);
  }

  // Safety: Block local dev URLs in production builds
  const isLocalUrl = databaseUrl.includes('localhost') ||
                     databaseUrl.includes('localtest.me') ||
                     databaseUrl.includes('127.0.0.1');

  if (process.env.VERCEL && isLocalUrl) {
    console.error('❌ Refusing to run migrations with local DATABASE_URL in Vercel build');
    console.error('   Set DATABASE_URL in Vercel project environment variables');
    process.exit(1);
  }

  // Log target database (masked for security)
  const dbHost = databaseUrl.split('@')[1]?.split('/')[0] || 'unknown';
  console.log(`🔄 Running migrations on: ${dbHost}`);

  const migrationsFolder = path.resolve(__dirname, '../drizzle');
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  console.log(`📋 Found ${journal.entries.length} migrations in journal`);

  const queryLogger = {
    logQuery: (query: string) => {
      const preview = query.slice(0, 200).replace(/\s+/g, ' ').trim();
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
      console.log(`[${timestamp}] ${preview}${query.length > 200 ? '...' : ''}`);
    },
  };

  try {
    if (isDirectConnection(databaseUrl)) {
      // Direct TCP connection via postgres-js
      const client = postgres(databaseUrl, { max: 1 });
      const db = drizzlePostgres(client, { logger: queryLogger });
      await migratePostgres(db, { migrationsFolder });
      console.log('✅ Migrations completed successfully');
      await client.end();
    } else {
      // Neon serverless connection
      configureNeonForLocal(databaseUrl);
      const pool = new Pool({ connectionString: databaseUrl });
      const db = drizzleNeon(pool, { logger: queryLogger });
      await migrateNeon(db, { migrationsFolder });
      console.log('✅ Migrations completed successfully');
      await pool.end();
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
