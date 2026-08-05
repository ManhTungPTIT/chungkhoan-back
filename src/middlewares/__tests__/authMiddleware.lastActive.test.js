// Heartbeat phiên gọi 5 lần/phút/user, mà verifyToken ghi `lastActive` MỖI
// request → 5 lượt ghi Mongo/phút/user, tốn hơn hẳn phần đọc của chính heartbeat.
//
// Chặn bằng điều kiện ngay trong filter thay vì đặc cách riêng đường /auth/session:
// làm ở filter thì mọi route đều được lợi và không ai phải nhớ bôi middleware.
// Không khớp filter thì Mongo không ghi gì, không sinh oplog.
import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../../models/userModel.js", () => ({
  User: { updateOne: vi.fn(() => ({ catch: vi.fn() })) },
}));

import { User } from "../../models/userModel.js";
import { verifyToken } from "../authMiddleware.js";

const SECRET = "test-access-secret";

function fakeReq(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = SECRET;
});

function signAccess(payload) {
  return jwt.sign({ ...payload, type: "access" }, SECRET, { expiresIn: "15m" });
}

describe("verifyToken — nhịp ghi lastActive", () => {
  it("chỉ ghi khi bản ghi cũ hơn ngưỡng", () => {
    const next = vi.fn();
    const before = Date.now();

    verifyToken(fakeReq(signAccess({ id: "u1", role: "user" })), fakeRes(), next);

    expect(next).toHaveBeenCalled();
    const [filter, update] = User.updateOne.mock.calls[0];
    expect(filter._id).toBe("u1");
    // null nằm trong $or để bắt cả document CHƯA từng có lastActive — Mongo cho
    // `null` khớp luôn field thiếu hẳn.
    const cutoff = filter.$or.find((c) => c.lastActive?.$lt)?.lastActive.$lt;
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.getTime()).toBeLessThan(before);
    expect(filter.$or).toContainEqual({ lastActive: null });
    expect(update.lastActive).toBeInstanceOf(Date);
  });

  it("admin không nằm trong collection User nên không ghi gì", () => {
    const next = vi.fn();

    verifyToken(fakeReq(signAccess({ id: "a1", role: "admin" })), fakeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("token hỏng → 401, không ghi gì", () => {
    const next = vi.fn();
    const res = fakeRes();

    verifyToken(fakeReq(jwt.sign({ id: "u1" }, "secret-khac")), res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});
