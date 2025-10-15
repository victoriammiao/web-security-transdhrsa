import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.js";

dotenv.config();

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

// ✅ 注册
export const register = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.status(400).json({ success: false, message: "缺少用户名或密码" });

        const existing = await User.findOne({ username });
        if (existing)
            return res.status(400).json({ success: false, message: "用户名已存在" });

        const hashed = await bcrypt.hash(password, saltRounds);
        const user = new User({ username, password: hashed });
        await user.save();

        res.json({ success: true, message: "注册成功" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "注册失败", error: err.message });
    }
};

// ✅ 登录
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user)
            return res.status(404).json({ success: false, message: "用户不存在" });

        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ success: false, message: "密码错误" });

        const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, {
            expiresIn: "2h",
        });

        res.json({
            success: true,
            message: "登录成功",
            token,
            username,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "登录失败", error: err.message });
    }
};

// ✅ 获取所有注册用户（不返回密码）
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, "username createdAt");
        res.json(users);
    } catch (err) {
        res.status(500).json({ success: false, message: "获取用户列表失败", error: err.message });
    }
};
