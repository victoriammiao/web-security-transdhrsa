import express from "express";
import { register, login, getAllUsers } from "../controllers/userController.js";

const router = express.Router();

// 注册新用户
router.post("/register", register);

// 登录用户
router.post("/login", login);

// 获取所有用户（不返回密码）
router.get("/all", getAllUsers);

export default router;
