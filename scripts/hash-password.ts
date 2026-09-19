import { hashPassword } from '../src/lib/server/auth.ts';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.ts <password>');
  process.exit(1);
}

console.log(hashPassword(password));
