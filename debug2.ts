import { db } from './src/config/db.js';

async function run() {
  const users = await db.collection('users').find().toArray();
  console.log('USERS:', users);
  process.exit(0);
}
run();
