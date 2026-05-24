import { auth } from './dist/auth/auth.js';

async function test() {
  const req = new Request('http://localhost:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "A", email: "a@b.com", password: "password123" })
  });
  const res = await auth.handler(req);
  console.log(res.status);
  console.log(await res.text());
}
test();
