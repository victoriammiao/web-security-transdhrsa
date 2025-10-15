import mongoose from "mongoose";

const MailSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    subject: String,
    algorithm: { type: String, enum: ["RSA", "DH"], required: true },
    ciphertextBase64: { type: String, required: true },
    ivBase64: { type: String, required: true },
    encryptedKeyBase64: { type: String, required: true },
    senderPublicKeyBase64: { type: String, required: true },
    authTagBase64: { type: String, required: true },
    fileBase64: { type: String, default: null }, // 附件内容（base64）
    fileName: { type: String, default: null }, // 附件文件名
    timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Mail", MailSchema);
