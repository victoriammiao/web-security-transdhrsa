import User from "../models/user.js";
import Mail from "../models/mail.js";

/**
 * 存储邮件（兼容 DH / RSA / PLAINTEXT）
 * 前端参考字段：
 * - common: from,to,subject,algorithm,fileBase64,fileName
 * - DH: ciphertextBase64, ivBase64, authTagBase64, ephemPubBase64
 * - RSA: ciphertextBase64, ivBase64, authTagBase64, encryptedKeyBase64, senderPublicKeyPem, signatureBase64
 */
export const sendMail = async (req, res) => {
    try {
        const payload = req.body;
        const { from, to } = payload;
        if (!from || !to) return res.status(400).json({ message: "from/to required" });

        const receiver = await User.findOne({ username: to });
        if (!receiver) return res.status(404).json({ message: "recipient not found" });

        const mailDoc = new Mail({
            from: payload.from,
            to: payload.to,
            subject: payload.subject || "",
            algorithm: payload.algorithm || "PLAINTEXT",
            ciphertextBase64: payload.ciphertextBase64 || null,
            ivBase64: payload.ivBase64 || null,
            authTagBase64: payload.authTagBase64 || null,
            ephemPubBase64: payload.ephemPubBase64 || null,
            encryptedKeyBase64: payload.encryptedKeyBase64 || null,
            senderPublicKeyPem: payload.senderPublicKeyPem || null,
            signatureBase64: payload.signatureBase64 || null,
            fileBase64: payload.fileBase64 || null,
            fileName: payload.fileName || null,
            createdAt: new Date(),
        });

        await mailDoc.save();
        return res.status(201).json({ success: true, mailId: mailDoc._id });
    } catch (err) {
        console.error("sendMail error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};

/** 获取收件箱（按 to 字段） */
export const getInbox = async (req, res) => {
    try {
        const username = req.query.username;
        if (!username) return res.status(400).json({ message: "username query required" });

        const mails = await Mail.find({ to: username })
            .sort({ createdAt: -1 })
            .select("-__v");
        return res.json(mails);
    } catch (err) {
        console.error("getInbox error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};

/** 读取单封邮件（返回全部存储字段，前端负责解密/验签演示） */
export const readMail = async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ message: "mail id required" });

        const mail = await Mail.findById(id).select("-__v");
        if (!mail) return res.status(404).json({ message: "mail not found" });

        // 简单权限检查：req.user.username（若有鉴权），否则支持 ?username=xxx 或 X-Username 头
        const requester =
            (req.user && req.user.username) ||
            req.query.username ||
            req.headers["x-username"];

        if (!requester) {
            return res.status(401).json({ message: "requester identity required (query.username or X-Username or auth)" });
        }

        if (requester !== mail.to && requester !== mail.from) {
            return res.status(403).json({ message: "forbidden: not mail participant" });
        }

        return res.json(mail);
    } catch (err) {
        console.error("readMail error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};
