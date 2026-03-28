import { neonConfig } from '@neondatabase/serverless';

export interface ConnectionConfig {
  connectionString: string;
  isLocal: boolean;
  isTest: boolean;
}

export function isLocalDevelopment(): boolean {
  return process.env.VERCEL_ENV === 'development' ||
         process.env.NODE_ENV === 'development';
}

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' ||
         process.env.VITEST === 'true';
}

export function getConnectionConfig(): ConnectionConfig {
  const connectionString = process.env.DATABASE_URL;
  const isLocal = isLocalDevelopment();
  const isTest = isTestEnvironment();

  // Use DATABASE_URL as-is if provided
  // Only fall back to local Docker database if DATABASE_URL is not set and in local development
  if (!connectionString && isLocal && !isTest) {
    return {
      connectionString: 'postgres://postgres:password@db.localtest.me:5432/main',
      isLocal,
      isTest,
    };
  }

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return { connectionString, isLocal, isTest };
}

/**
 * Returns true when DATABASE_URL points to a direct PostgreSQL connection
 * (not Neon serverless and not the local Neon proxy).
 * Used to decide whether to use postgres-js (TCP) or @neondatabase/serverless.
 */
export function isDirectConnection(): boolean {
  const { connectionString } = getConnectionConfig();
  const hostname = new URL(connectionString).hostname;
  // Neon hosts: *.neon.tech
  // Local Neon proxy: db.localtest.me
  // Everything else (localhost, 127.0.0.1, Docker service names, custom hosts) = direct
  if (hostname === 'db.localtest.me') return false;
  if (hostname.endsWith('.neon.tech')) return false;
  return true;
}

export function configureNeonForEnvironment(): void {
  const { connectionString } = getConnectionConfig();
  const connectionStringUrl = new URL(connectionString);
  const isLocalDb = connectionStringUrl.hostname === 'db.localtest.me';

  // Only apply local Neon proxy settings for the local Docker database
  if (isLocalDb) {
    neonConfig.fetchEndpoint = (host) => {
      const [protocol, port] = host === 'db.localtest.me' ? ['http', 4444] : ['https', 443];
      return `${protocol}://${host}:${port}/sql`;
    };
    neonConfig.useSecureWebSocket = false;
    neonConfig.wsProxy = (host) => (host === 'db.localtest.me' ? `${host}:4444/v2` : `${host}/v2`);
  }
}
