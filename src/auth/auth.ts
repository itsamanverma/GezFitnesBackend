import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { db, client } from '../config/db.js';
import { env } from '../config/env.js';
import { dash } from '@better-auth/infra';

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    usePlural: true, // Uses users, sessions, accounts collection names
    transaction: false, // Local DB is standalone, doesn't support transactions
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    ...(env.PINGGY_URL ? [env.PINGGY_URL] : []),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: env.APPLE_CLIENT_ID,
            clientSecret: env.APPLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    ...(env.NODE_ENV !== 'test' && env.BETTER_AUTH_API_KEY ? [dash()] : []),
  ],
});
