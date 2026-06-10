/**
 * Daily Backup Script
 * Run manually: node backup-daily.js
 * Or schedule via Windows Task Scheduler / cron
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management';
const BACKUP_DIR = path.join(__dirname, 'backups');

async function runBackup() {
  console.log('\n========================================');
  console.log('   HOSTEL MANAGER — Daily Backup');
  console.log('   ' + new Date().toLocaleString('en-IN'));
  console.log('========================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('Database connected.');

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const Member = require('./models/Member');
  const ArchivedMember = require('./models/ArchivedMember');
  const Receipt = require('./models/Receipt');
  const Electric = require('./models/Electric');
  const Salary = require('./models/Salary');
  const Hostel = require('./models/Hostel');
  const User = require('./models/User');

  const [members, archived, receipts, electric, salaries, hostels, users] = await Promise.all([
    Member.find().lean(),
    ArchivedMember.find().lean(),
    Receipt.find().lean(),
    Electric.find().lean(),
    Salary.find().lean(),
    Hostel.find().lean(),
    User.find().select('-password').lean(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    version: '8.0',
    counts: { members: members.length, archived: archived.length, receipts: receipts.length, electric: electric.length, salaries: salaries.length },
    data: { hostels, users, members, archivedMembers: archived, receipts, electric, salaries },
  };

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `hostel-backup-${dateStr}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

  // Keep only last 30 backups
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('hostel-backup-')).sort();
  while (files.length > 30) {
    const old = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    console.log('Deleted old backup:', old);
  }

  console.log('Backup saved:', filepath);
  console.log('\nSummary:');
  Object.entries(backup.counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\nDone! Backup folder:', BACKUP_DIR);

  await mongoose.disconnect();
  process.exit(0);
}

runBackup().catch(err => {
  console.error('\nBackup failed:', err.message);
  process.exit(1);
});
