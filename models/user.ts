/**
 * User (PRD §5.6 / Stage 1.6).
 *
 * `passwordHash` and the auth tokens are `select: false` (never leave the DB by
 * default). `emailVerified` follows the Auth.js convention (a `Date` when
 * verified, else null). Auth flows are wired in Stage 2. Soft-deleted per §5.
 */
import { Schema, type Types } from "mongoose";
import { AUTH_PROVIDERS, USER_ROLES, USER_STATUSES } from "@/lib/enums";
import type { AuthProvider, UserRole, UserStatus } from "@/lib/enums";
import {
  imageSchema,
  softDeletePlugin,
  registerModel,
  type IImage,
  type SoftDeleteFields,
  type TimestampFields,
} from "@/models/_shared";

export interface ISavedSearch {
  _id?: Types.ObjectId;
  label?: string;
  /** Serialized directory query string, e.g. "?treatment=msc&country=mexico". */
  query: string;
  createdAt: Date;
}

export interface IUser extends TimestampFields, SoftDeleteFields {
  _id: Types.ObjectId;
  name?: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  emailVerified?: Date | null;
  avatar?: IImage;
  provider: AuthProvider;
  shortlist: Types.ObjectId[];
  savedSearches: ISavedSearch[];
  status: UserStatus;
  lastLoginAt?: Date | null;
  // Stage 2 auth support (PRD-ASSUMPTION: not in §5.6 table). All select:false.
  // Tokens are stored *hashed* (SHA-256) — see lib/auth/tokens.ts.
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

const savedSearchSchema = new Schema<ISavedSearch>({
  label: { type: String, trim: true },
  query: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: () => new Date() },
});

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: USER_ROLES, default: "member", index: true },
    emailVerified: { type: Date, default: null },
    avatar: { type: imageSchema, default: undefined },
    provider: { type: String, enum: AUTH_PROVIDERS, default: "credentials" },
    shortlist: {
      type: [{ type: Schema.Types.ObjectId, ref: "Clinic" }],
      default: [],
    },
    savedSearches: { type: [savedSearchSchema], default: [] },
    status: { type: String, enum: USER_STATUSES, default: "active" },
    lastLoginAt: { type: Date, default: null },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

softDeletePlugin(UserSchema);

export const User = registerModel<IUser>("User", UserSchema);
export default User;
