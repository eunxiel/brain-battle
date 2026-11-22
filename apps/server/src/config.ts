import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  /** Comma separated list, or '*' in development. */
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
};
