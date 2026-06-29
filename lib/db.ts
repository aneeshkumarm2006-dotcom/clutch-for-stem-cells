/**
 * MongoDB connection helper — Stage 0.6.
 *
 * Caches the connection across hot reloads (dev) and serverless invocations
 * (Vercel) on the Node global so we never open more than one pool per process.
 */
import mongoose, { type Mongoose } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Reuse the cache across module reloads in dev and warm lambdas in prod.
declare global {
  // eslint-disable-next-line no-var
  var _mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

export async function dbConnect(): Promise<Mongoose> {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example).",
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next call can retry instead of reusing a rejected promise.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

export default dbConnect;
