/**
 * AnalyticsHub config store — a single encrypted key/value collection backing
 * the self-contained analytics dashboard (`/analyticshub`).
 *
 * Every `value` is an AES-256-GCM ciphertext (see `lib/analyticshub/crypto.ts`);
 * this model only ever sees opaque strings. One row per key: the owner password
 * hash, the project settings, each source's connection config, cached source
 * responses (`cache:*`), and login rate-limit counters (`ratelimit:*`).
 *
 * Serverless-safe: Mongo creates the collection on first write, so there is no
 * migration or GRANT step (unlike the Postgres path the spec also covers).
 */
import "server-only";
import { Schema, type Model } from "mongoose";

import { registerModel, type TimestampFields } from "@/models/_shared";

export interface IAnalyticsHubConfig extends TimestampFields {
  key: string;
  value: string;
}

const AnalyticsHubConfigSchema = new Schema<IAnalyticsHubConfig>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
  },
  { timestamps: true, collection: "analyticshub_config" },
);

export const AnalyticsHubConfig: Model<IAnalyticsHubConfig> = registerModel(
  "AnalyticsHubConfig",
  AnalyticsHubConfigSchema,
);
