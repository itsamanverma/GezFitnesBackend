import { auth } from './src/auth/auth.ts';
console.log(Object.keys(auth.api).filter(k => k.toLowerCase().includes('email')));
console.log(auth.options.baseURL);
