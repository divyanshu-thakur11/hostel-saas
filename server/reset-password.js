/**
 * HOSTEL MANAGER — Password Reset Tool
 * Double-click reset-password.bat to run this.
 * No technical knowledge needed.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function line(char = '-', len = 44) { console.log(char.repeat(len)); }
function blank() { console.log(''); }

async function main() {
  blank();
  line('=');
  console.log('   HOSTEL MANAGER — Password Reset Tool');
  line('=');
  blank();
  console.log('  Connecting to database...');

  try {
    await mongoose.connect(MONGODB_URI);
  } catch(e) {
    blank();
    console.log('  ERROR: Could not connect to the database!');
    console.log('  Make sure the server (start.bat) is running first.');
    blank();
    line('=');
    await ask('  Press Enter to close...');
    rl.close(); return;
  }

  console.log('  Connected successfully!');
  blank();

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const allUsers = await users.find({}, { projection: { password: 0 } }).toArray();

  if (allUsers.length === 0) {
    console.log('  No accounts found. Creating default owner account...');
    blank();
    const hashed = await bcrypt.hash('owner123', 10);
    await users.insertOne({
      username: 'owner', password: hashed, name: 'Owner', role: 'owner',
      isActive: true, recentActivity: [], createdAt: new Date(), updatedAt: new Date(),
    });
    line('=');
    console.log('  Owner account created!');
    console.log('  Username : owner');
    console.log('  Password : owner123');
    console.log('  Please login and change this password immediately.');
    line('=');
    blank();
    await ask('  Press Enter to close...');
    rl.close(); await mongoose.disconnect(); return;
  }

  // Separate owners and managers
  const owners = allUsers.filter(u => u.role === 'owner');
  const managers = allUsers.filter(u => u.role === 'manager');

  console.log('  Select whose password to reset:');
  blank();
  console.log('  --- OWNER ---');
  owners.forEach((u, i) => {
    const status = u.isActive === false ? ' [DISABLED]' : '';
    console.log(`  ${i + 1}. ${u.name} (@${u.username})${status}`);
  });
  blank();
  console.log('  --- MANAGERS ---');
  managers.forEach((u, i) => {
    const status = u.isActive === false ? ' [DISABLED]' : '';
    console.log(`  ${owners.length + i + 1}. ${u.name} (@${u.username})${status}`);
  });
  blank();
  console.log('  0. Cancel — exit without changes');
  blank();

  const choice = await ask('  Enter number: ');
  const idx = parseInt(choice.trim()) - 1;

  if (choice.trim() === '0' || isNaN(idx) || idx < 0 || idx >= allUsers.length) {
    blank();
    console.log('  Cancelled. No changes were made.');
    blank();
    await ask('  Press Enter to close...');
    rl.close(); await mongoose.disconnect(); return;
  }

  const orderedUsers = [...owners, ...managers];
  const selected = orderedUsers[idx];

  blank();
  line('-');
  console.log(`  Resetting password for: ${selected.name}`);
  console.log(`  Role: ${selected.role}  |  Username: @${selected.username}`);
  line('-');
  blank();

  let newPassword = '';
  while (true) {
    newPassword = await ask('  Enter new password (min 6 characters): ');
    newPassword = newPassword.trim();
    if (newPassword.length >= 6) break;
    console.log('  Too short! Please use at least 6 characters.');
    blank();
  }

  const confirm = await ask('  Confirm new password: ');
  if (newPassword !== confirm.trim()) {
    blank();
    console.log('  Passwords do not match. No changes made.');
    blank();
    await ask('  Press Enter to close...');
    rl.close(); await mongoose.disconnect(); return;
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await users.updateOne(
    { _id: selected._id },
    { $set: { password: hashed, isActive: true, updatedAt: new Date() } }
  );

  blank();
  line('=');
  console.log('  Password reset SUCCESSFUL!');
  line('-');
  console.log(`  Name     : ${selected.name}`);
  console.log(`  Username : ${selected.username}`);
  console.log(`  Password : ${newPassword}`);
  console.log(`  Role     : ${selected.role}`);
  line('-');
  console.log('  You can now log in with these credentials.');
  console.log('  Please remember to write down the password safely.');
  line('=');
  blank();

  await ask('  Press Enter to close...');
  rl.close();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  blank();
  console.log('  UNEXPECTED ERROR: ' + err.message);
  console.log('  Make sure MongoDB is running and try again.');
  blank();
  await ask('  Press Enter to close...');
  rl.close();
  process.exit(1);
});
