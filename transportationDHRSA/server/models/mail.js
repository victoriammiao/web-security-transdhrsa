import mongoose from 'mongoose';

const MailSchema = new mongoose.Schema({
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    subject: { type: String, default: "" },

    // 算法类型： "DH" | "RSA" | "PLAINTEXT"
    algorithm: { type: String, default: "PLAINTEXT" },

    // 加密相关字段（前端发送并存储原样）
    ciphertextBase64: { type: String, default: null },
    ivBase64: { type: String, default: null },
    authTagBase64: { type: String, default: null },

    // DH 特有：发送者临时公钥 (raw base64)
    ephemPubBase64: { type: String, default: null },

    // RSA 特有：加密的 AES 密钥、发送者公钥与签名
    encryptedKeyBase64: { type: String, default: null }, // Ckey
    senderPublicKeyPem: { type: String, default: null },
    signatureBase64: { type: String, default: null },

    // 附件
    fileBase64: { type: String, default: null },
    fileName: { type: String, default: null },

    // 可选：服务器端尝试解密/验签的结果（如果启用）
    plaintext: { type: String, default: null },
    signatureValid: { type: Boolean, default: undefined },
    serverDecryptError: { type: String, default: null },

    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Mail', MailSchema);
