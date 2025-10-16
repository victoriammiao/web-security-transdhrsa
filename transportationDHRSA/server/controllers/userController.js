import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.js";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || "dev-secret";

// 用户注册
export const register = async (req, res) => {
    try {
        const { username, password, rsaPublicSpkiBase64, ecdhPublicRawBase64, privkeyPkcs8Base64 } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "用户名和密码必填" });
        }

        // 检查用户是否已存在
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "用户名已存在" });
        }

        // 加密密码
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 创建新用户
        const newUser = new User({
            username,
            passwordHash,
            rsaPublicSpkiBase64: rsaPublicSpkiBase64 || null,
            ecdhPublicRawBase64: ecdhPublicRawBase64 || null,
            recipientPublicRawBase64: ecdhPublicRawBase64 || null,
            privkeyPkcs8Base64: privkeyPkcs8Base64 || null
        });

        await newUser.save();

        return res.json({
            success: true,
            message: "注册成功",
            username: newUser.username
        });
    } catch (err) {
        console.error("注册错误:", err);
        return res.status(500).json({
            success: false,
            message: "内部错误",
            error: err.message
        });
    }
};

// 登录
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: "username/password required" });

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, message: "user not found" });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ success: false, message: "invalid credentials" });

        const token = jwt.sign({ id: user._id, username: user.username }, jwtSecret, { expiresIn: "2h" });
        return res.json({ success: true, message: "login success", token, username: user.username });
    } catch (err) {
        console.error("login error:", err);
        return res.status(500).json({ success: false, message: "internal error", error: err.message });
    }
};

// 返回所有用户（不含密码/私钥）
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, { username: 1, _id: 0 }).lean();
        return res.json(users);
    } catch (err) {
        console.error("getAllUsers error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};

/**
 * 返回用户公钥（用于发送方获取接收方公钥）
 * 返回格式：
 * - { recipientPublicRawBase64: "..." }  或 { pubkeyPem: "-----BEGIN PUBLIC KEY-----..."}
 */
export const getPubkey = async (req, res) => {
    try {
        const username = req.params.username;
        const user = await User.findOne({ username }).lean();
        if (!user) return res.status(404).json({ message: "user not found" });

        if (user.recipientPublicRawBase64) {
            return res.json({ recipientPublicRawBase64: user.recipientPublicRawBase64 });
        } else if (user.pubkeyPem) {
            return res.json({ pubkeyPem: user.pubkeyPem });
        } else if (user.rsaPublicSpkiBase64) {
            return res.json({ rsaPublicSpkiBase64: user.rsaPublicSpkiBase64 });
        } else {
            return res.status(404).json({ message: "user public key not available" });
        }
    } catch (err) {
        console.error("getPubkey error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};

/**
 * 返回用户私钥（仅用于本地教学/调试！生产环境严禁暴露）
 * 返回示例字段： { privkeyPkcs8Base64: "...", privkeyPem: "-----BEGIN PRIVATE KEY-----..." }
 */
export const getPrivkey = async (req, res) => {
    try {
        const username = req.params.username;
        // 强烈建议限制访问并在生产环境移除此接口
        const user = await User.findOne({ username }).lean();
        if (!user) return res.status(404).json({ message: "user not found" });

        const out = {};
        if (user.privkeyPkcs8Base64) out.privkeyPkcs8Base64 = user.privkeyPkcs8Base64;
        if (user.privkeyPem) out.privkeyPem = user.privkeyPem;
        if (user.privScalarBase64) out.privScalarBase64 = user.privScalarBase64;

        if (!Object.keys(out).length) return res.status(404).json({ message: "private key not stored on server" });
        return res.json(out);
    } catch (err) {
        console.error("getPrivkey error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};

// 新增：按 q 参数搜索用户名（用于前端输入时查找）
export const searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      // 如果没有 q，返回所有用户（不暴露敏感字段）
      const users = await User.find({}, { username: 1, _id: 0 }).lean();
      return res.json(users);
    }
    // 模糊匹配：前缀或包含，大小写不敏感；限制结果条数
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ username: { $regex: regex } }, { username: 1, _id: 0 })
      .limit(50)
      .lean();
    return res.json(users);
  } catch (err) {
    console.error("searchUsers error:", err);
    return res.status(500).json({ message: "internal error", error: err.message });
  }
};