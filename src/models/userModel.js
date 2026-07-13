import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    // Tài khoản có thể là email HOẶC số điện thoại — không bắt buộc email.
    // sparse: index unique bỏ qua doc thiếu trường (tránh đụng nhau ở null).
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    // Định danh chứng khoán: sàn (thuộc tính để lọc VPS/TCBS ở admin) + số tài
    // khoản. brokerAccount là ĐỊNH DANH ĐĂNG NHẬP giống email/phone — unique
    // sparse toàn hệ thống để gõ 1 mình số TK là đủ tra ra user (không cần chọn
    // sàn lúc login). broker KHÔNG tham gia uniqueness.
    broker: {
      type: String,
      enum: ["VPS", "TCBS"],
      required: false,
    },
    brokerAccount: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default:
        "https://i.pinimg.com/736x/6f/a3/6a/6fa36aa2c367da06b2a4c8ae1cf9ee02.jpg",
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    // pending = chờ admin duyệt | active = đã duyệt | rejected = bị từ chối
    // locked = bị khóa | deleted = đã xóa (soft delete)
    status: {
      type: String,
      default: "pending",
    },
    // Ngày hết hạn gói. null = không giới hạn. Quá hạn → login bị chặn.
    expiresAt: {
      type: Date,
      default: null,
    },
    // Yêu cầu đăng ký gói của user, chờ admin duyệt. Mỗi user 1 yêu cầu tại một
    // thời điểm (nhúng thay vì collection riêng). status: pending → admin duyệt
    // (approved, cộng days vào expiresAt) hoặc từ chối (rejected). _id: false vì
    // là bản ghi con đơn, không cần id riêng — admin thao tác theo user._id.
    packageRequest: {
      type: new mongoose.Schema(
        {
          titles: {type: String},
          days: { type: Number },
          status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
          },
          requestedAt: { type: Date },
        },
        { _id: false },
      ),
      default: null,
    },
    // Mốc hoạt động gần nhất — cập nhật khi login/register và ở mỗi request có
    // token user hợp lệ (verifyToken). Dùng để tính online/offline.
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
