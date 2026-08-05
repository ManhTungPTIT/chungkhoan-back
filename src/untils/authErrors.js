// Mã lỗi phiên trả cho FE. `message` giữ nguyên chuỗi cũ để caller hiện tại
// không gãy; `code` là thứ FE nên phân nhánh theo.
export const AUTH_ERROR = {
  INVALID_TOKEN: "INVALID_TOKEN",
  SESSION_SUPERSEDED: "SESSION_SUPERSEDED",
};

export function authError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
