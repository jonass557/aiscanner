import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * Spins up an in-memory MongoDB for integration tests so they run fast and
 * isolated, with no external database required.
 *
 * Windows environments can be slow to download/launch the mongod binary on the
 * first run, so we set a generous 60s timeout (vs. the default 10s).
 */
let mongod;

export const connectTestDB = async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 }, // 60s instead of default 10s
  });
  await mongoose.connect(mongod.getUri());
};

export const clearTestDB = async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

export const closeTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
};
