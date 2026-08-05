import mongoose from "mongoose";

// MỘT DOCUMENT = MỘT PHIÊN, không phải một token.
//
// Xoay vòng refresh token cập nhật TẠI CHỖ (tokenHash mới, sid giữ nguyên) thay
// vì xoá hàng cũ + tạo hàng mới. Nhờ vậy "phiên" có danh tính bền vững để đá,
// và quan trọng hơn: phiên bị đá còn nằm lại kèm lý do, nên /auth/refresh phân
// biệt được "bị thay thế" với "token bị dùng lại" — xem specs 2026-08-05.
const refreshTokenSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, enum: ["admin", "user"], required: true },
    // Chỗ ngồi của phiên. Whitelist đóng — xem untils/clientType.js.
    platform: { type: String, enum: ["web", "app"], required: true, default: "web" },
    // Id phiên, GIỮ NGUYÊN qua mọi lần xoay vòng token.
    sid: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String, required: true },
    // Token vừa bị xoay + hạn dùng của nó: cửa sổ ân hạn cho hai tab đua nhau
    // gọi /auth/refresh (xem ROTATION_GRACE_MS).
    prevTokenHash: { type: String, default: null },
    prevUsableUntil: { type: Date, default: null },
    // null = phiên đang sống. Mongo cho `revokedAt: null` khớp CẢ document thiếu
    // hẳn field, nên hàng tạo trước thay đổi này vẫn được tính là đang sống —
    // không cần script backfill.
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ["superseded", "reuse", "logout", null],
      default: null,
    },
    // Mongo TTL monitor deletes the doc once now >= expiresAt
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: documents are removed when expiresAt passes
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Tìm phiên đang sống của một tài khoản trên một nền tảng (đường đi của login).
refreshTokenSchema.index({ subjectId: 1, platform: 1, revokedAt: 1 });
// Tra token vừa bị xoay trong cửa sổ ân hạn.
refreshTokenSchema.index({ prevTokenHash: 1 }, { sparse: true });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
