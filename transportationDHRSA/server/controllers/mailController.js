import crypto from "crypto";
import fs from "fs";
import Mail from "../models/mail.js";
import User from "../models/user.js";

/** AES-GCM 加密函数 */
function encryptAESGCM(plaintext) {
    const key = crypto.randomBytes(32); // AES-256
    const iv = crypto.randomBytes(12); // GCM推荐12字节IV
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag().toString("base64");
    return { ciphertextBase64: encrypted, ivBase64: iv.toString("base64"), key, authTag };
}

/** AES-GCM 解密函数 */
function decryptAESGCM(ciphertextBase64, key, ivBase64, authTagBase64) {
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(ivBase64, "base64")
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));
    let decrypted = decipher.update(ciphertextBase64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

/** 发送加密邮件（可带文件） */
export const sendMail = async (req, res) => {
    try {
        const { from, to, subject, body, algorithm, fileBase64, fileName } = req.body;

        const receiver = await User.findOne({ username: to });
        if (!receiver) return res.status(404).json({ message: "接收方不存在" });

        // 1️⃣ 对正文和文件内容生成 AES 加密
        const dataToEncrypt = fileBase64 ? body + "[文件已附加]" : body;
        const { ciphertextBase64, ivBase64, key, authTag } = encryptAESGCM(dataToEncrypt);

        // 2️⃣ 根据算法选择加密密钥方式
        let encryptedKeyBase64 = null;
        let senderPublicKeyBase64 = null;

        if (algorithm === "RSA") {
            const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
            senderPublicKeyBase64 = publicKey.export({ type: "pkcs1", format: "pem" });
            encryptedKeyBase64 = crypto.publicEncrypt(senderPublicKeyBase64, key).toString("base64");
        } else if (algorithm === "DH") {
            const dh = crypto.createDiffieHellman(2048);
            const dhPublicKey = dh.generateKeys();
            const dhPrivateKey = dh.getPrivateKey();
            senderPublicKeyBase64 = dhPublicKey.toString("base64");
            // 简化：不实际计算共享密钥，仅存公钥用于展示
            encryptedKeyBase64 = key.toString("base64");
        }

        // 3️⃣ 保存到数据库
        const mail = new Mail({
            from,
            to,
            subject,
            algorithm,
            ciphertextBase64,
            ivBase64,
            senderPublicKeyBase64,
            encryptedKeyBase64,
            authTagBase64: authTag,
            fileBase64: fileBase64 || null,
            fileName: fileName || null,
            timestamp: new Date(),
        });

        await mail.save();
        res.json({ message: "邮件已加密并保存", algorithm });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "发送失败", error: err.message });
    }
};

/** 获取用户收件箱 */
export const getInbox = async (req, res) => {
    try {
        const { username } = req.query;
        const mails = await Mail.find({ to: username }).sort({ timestamp: -1 });
        res.json(mails);
    } catch (err) {
        res.status(500).json({ message: "获取邮件失败", error: err.message });
    }
};

/** 解密查看邮件内容 */
export const readMail = async (req, res) => {
    try {
        const mail = await Mail.findById(req.params.id);
        if (!mail) return res.status(404).json({ message: "邮件不存在" });

        // 简化逻辑：假设使用原始保存的 AES 密钥（教学演示）
        const decryptedText = decryptAESGCM(
            mail.ciphertextBase64,
            Buffer.from(mail.encryptedKeyBase64, "base64"),
            mail.ivBase64,
            mail.authTagBase64
        );

        const response = {
            from: mail.from,
            subject: mail.subject,
            body: decryptedText,
            fileName: mail.fileName,
            fileBase64: mail.fileBase64,
        };

        res.json(response);
    } catch (err) {
        res.status(500).json({ message: "解密失败", error: err.message });
    }
};
