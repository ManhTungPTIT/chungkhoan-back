import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: ["admin", "user"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String, required: true },
    // Mongo TTL monitor deletes the doc once now >= expiresAt
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: documents are removed when expiresAt passes
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
