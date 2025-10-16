// server/models/user.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },

    // 公钥（可选，前端/其它用户用于加密）
    // RSA 公钥（SPKI raw 的 base64，或者可使用 pubkeyPem）
    rsaPublicSpkiBase64: { type: String, default: null },
    pubkeyPem: { type: String, default: null }, // 可存 PEM 格式的公钥（spki PEM）

    // ECDH / DH 公钥（raw bytes 的 base64，用于浏览器直接 importKey("raw")）
    ecdhPublicRawBase64: { type: String, default: null },
    recipientPublicRawBase64: { type: String, default: null }, // 兼容名称

    // 私钥（仅用于本地教学/调试 — 生产请不要保存或暴露）
    // 私钥 pkcs8 的 base64 表示（可直接导入为 "pkcs8"）
    privkeyPkcs8Base64: { type: String, default: null },
    // 私钥 PEM（例如 "-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----"）
    privkeyPem: { type: String, default: null },
    // ECDH 私标量 raw（base64），便于 Node-side 使用 createECDH（仅测试）
    privScalarBase64: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
