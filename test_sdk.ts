import { auth } from './src/auth/auth.js';
import { db } from './src/config/db.js';

async function run() {
  const res = await auth.api.signInEmail({
    body: {
      email: 'v1.test2@example.com',
      password: 'password123'
    }
  });
  console.log(res);
  process.exit(0);
}
run();
