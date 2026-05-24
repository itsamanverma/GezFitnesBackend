import { auth } from './src/auth/auth.js';
import { db } from './src/config/db.js';

async function run() {
  const headers = new Headers();
  headers.set('Authorization', 'Bearer lTUo5X4nXUcgVNCYSRttRPMtXBDo8MZt');
  
  const res = await auth.api.getSession({ headers });
  console.log(res);
  process.exit(0);
}
run();
