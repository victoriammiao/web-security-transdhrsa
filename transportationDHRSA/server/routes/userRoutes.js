import express from "express";
import { getAllUsers, getPubkey, getPrivkey, searchUsers } from "../controllers/userController.js";

const router = express.Router();

// 获取所有用户（不返回密码）
router.get("/all", getAllUsers);
// 新增：按 q 搜索用户
router.get("/search", searchUsers);
// 获取公钥
router.get("/:username/pubkey", getPubkey);
// 获取私钥（调试专用：生产应禁用）
router.get("/:username/privkey", getPrivkey);

export default router;
