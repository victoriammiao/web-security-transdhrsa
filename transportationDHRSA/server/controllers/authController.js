// ...existing code...
import bcrypt from "bcryptjs";
import User from "../models/user.js";

export const register = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "username and password required" });

        const exists = await User.findOne({ username });
        if (exists) return res.status(409).json({ message: "username already exists" });

        const saltRounds = 12;
        const hash = await bcrypt.hash(password, saltRounds);

        const user = new User({
            username,
            passwordHash: hash,
            // 其它公/私钥字段保持为空（后续可由用户生成并上传）
        });

        await user.save();
        return res.status(201).json({ success: true, username: user.username });
    } catch (err) {
        console.error("register error:", err);
        return res.status(500).json({ message: "internal error", error: err.message });
    }
};
// ...existing code...