/**
 * Emergency password reset script.
 * Run from the project root:
 *   node reset-password.js
 *
 * Or with custom values:
 *   node reset-password.js superadmin MyNewPassword123
 */
const mongoose = require('./server/node_modules/mongoose');
const bcrypt   = require('./server/node_modules/bcryptjs');
const path     = require('path');
const fs       = require('fs');

// Load .env manually
const envPath = path.join(__dirname, 'server', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
  });
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_saas';
const username  = process.argv[2] || 'superadmin';
const newPass   = process.argv[3] || 'Admin@1234';

async function run() {
  console.log(`\nConnecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const db   = mongoose.connection.db;
  const hash = await bcrypt.hash(newPass, 10);

  const result = await db.collection('users').updateOne(
    { username: username.toLowerCase() },
    { $set: { password: hash, mustChangePassword: true, loginAttempts: 0, lockUntil: null } }
  );

  if (result.matchedCount === 0) {
    console.log(`❌ No user found with username: "${username}"`);
    console.log('   Available usernames:');
    const all = await db.collection('users').find({}, { projection: { username:1, role:1 } }).toArray();
    all.forEach(u => console.log(`   - ${u.username} (${u.role})`));
  } else {
    console.log(`✅ Password reset for "${username}"`);
    console.log(`   New password: ${newPass}`);
    console.log(`   You will be asked to change it on first login.\n`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
