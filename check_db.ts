import { db } from './src/config/db.js';

async function run() {
  const sessions = await db.collection('sessions').find().toArray();
  console.log('SESSIONS:');
  console.log(sessions);
  process.exit(0);
}
run();
