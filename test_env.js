import dotenv from 'dotenv';
const result = dotenv.config();
console.log("Parsed:", result.parsed.BETTER_AUTH_URL);
