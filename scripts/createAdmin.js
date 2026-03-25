/**
 * Quick script to create an admin user
 * Usage: node scripts/createAdmin.js
 * Or:    node scripts/createAdmin.js admin@example.com MyPassword@123 "Admin Name"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/connectai';

const [,, emailArg, passwordArg, nameArg] = process.argv;

const EMAIL    = emailArg    || 'admin@connectai.com';
const PASSWORD = passwordArg || 'Admin@123';
const NAME     = nameArg     || 'Super Admin';

async function createAdmin() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  const existing = await users.findOne({ email: EMAIL });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`⚠️  Admin already exists: ${EMAIL}`);
    } else {
      // Upgrade existing user to admin
      await users.updateOne({ email: EMAIL }, { $set: { role: 'admin' } });
      console.log(`✅ Upgraded existing user to admin: ${EMAIL}`);
    }
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  await users.insertOne({
    name: NAME,
    email: EMAIL,
    password: hashedPassword,
    role: 'admin',
    isVerified: true,
    isProfileComplete: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('✅ Admin created successfully!');
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`   Name:     ${NAME}`);

  await mongoose.disconnect();
}

createAdmin().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
