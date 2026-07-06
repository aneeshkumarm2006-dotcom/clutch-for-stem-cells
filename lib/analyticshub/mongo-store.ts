/**
 * MongoStore — the production {@link HubStore}, backed by the
 * `analyticshub_config` collection. Encrypts on write and decrypts on read, so
 * the DB only ever holds AES-GCM ciphertext.
 *
 * DB/secret failures are translated into {@link HubError}s that name the fix
 * (unreachable DB vs a bad secret), so `/status` can report the exact problem
 * instead of a vague 500. Env is read lazily via `dbConnect()`.
 */
import "server-only";

import { dbConnect } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/analyticshub/crypto";
import { HubError, isHubError } from "@/lib/analyticshub/errors";
import type { HubStore } from "@/lib/analyticshub/store";
import { AnalyticsHubConfig } from "@/models/analyticshub-config";

function wrapDbError(err: unknown): HubError {
  // A bad-secret error from decrypt() must surface as-is, not be masked as a DB
  // problem.
  if (isHubError(err)) return err;
  return new HubError(
    "db_unreachable",
    "Could not reach MongoDB. Check that MONGODB_URI is set and the database is reachable from this deployment.",
    503,
  );
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class MongoStore implements HubStore {
  async get(key: string): Promise<string | null> {
    try {
      await dbConnect();
      const row = await AnalyticsHubConfig.findOne({ key })
        .select("value")
        .lean();
      return row ? decrypt(row.value) : null;
    } catch (err) {
      throw wrapDbError(err);
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await dbConnect();
      await AnalyticsHubConfig.updateOne(
        { key },
        { $set: { value: encrypt(value) } },
        { upsert: true },
      );
    } catch (err) {
      throw wrapDbError(err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await dbConnect();
      await AnalyticsHubConfig.deleteOne({ key });
    } catch (err) {
      throw wrapDbError(err);
    }
  }

  async keys(prefix: string): Promise<string[]> {
    try {
      await dbConnect();
      const rows = await AnalyticsHubConfig.find({
        key: { $regex: `^${escapeRegex(prefix)}` },
      })
        .select("key")
        .lean();
      return rows.map((r) => r.key);
    } catch (err) {
      throw wrapDbError(err);
    }
  }

  /** Cheap connectivity probe for `/status` — true if the DB answered. */
  async ping(): Promise<boolean> {
    try {
      await dbConnect();
      await AnalyticsHubConfig.estimatedDocumentCount();
      return true;
    } catch {
      return false;
    }
  }
}
