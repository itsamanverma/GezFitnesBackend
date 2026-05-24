import { db } from './src/config/db.js';
import { verifyAccessToken } from './src/auth/jwt.js';

async function run() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTExNjk4N2U2NjEyMWZjYzQ3YWRlZGMiLCJzZXNzaW9uSWQiOiJLSW5JYkVDTGF1V1JqZjdMV1Z2ZW51WmJxTXI5enlwMCIsImlhdCI6MTc3OTUyNjIxMCwiZXhwIjoxNzc5NTI3MTEwfQ.5atcc7qJsRX85ZHDOh9gMeXPaTKglthOx39rh9eoe8k';
  const decoded = verifyAccessToken(token);
  console.log('DECODED:', decoded);
  
  if (decoded) {
    const session = await db.collection('sessions').findOne({ token: decoded.sessionId });
    console.log('SESSION FOUND:', session);
  }
  process.exit(0);
}
run();
