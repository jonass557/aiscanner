/**
 * Seeds an admin account from environment credentials.
 * Idempotent: if the admin already exists, it's promoted rather than duplicated.
 *
 * Usage: npm run seed:admin
 */
import config from '../config/index.js';
import logger from '../config/logger.js';
import { connectDB, disconnectDB } from '../config/database.js';
import User from '../models/User.js';
import { getPlan } from '../config/plans.js';

const run = async () => {
  await connectDB();

  const existing = await User.findOne({ email: config.admin.email });
  if (existing) {
    existing.role = 'admin';
    existing.isVerified = true;
    await existing.save();
    logger.info(`Existing user ${config.admin.email} promoted to admin.`);
  } else {
    const premium = getPlan('premium');
    await User.create({
      email: config.admin.email,
      password: config.admin.password,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isVerified: true,
      subscription: {
        plan: 'premium',
        status: 'active',
        scansPerMonth: premium.scansPerMonth,
        scansUsed: 0,
      },
    });
    logger.info(`Admin account created: ${config.admin.email}`);
  }

  await disconnectDB();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
