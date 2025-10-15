import express from "express";
import { sendMail, getInbox, readMail } from "../controllers/mailController.js";

const router = express.Router();

router.post("/send", sendMail);
router.get("/inbox", getInbox);
router.get("/read/:id", readMail);

export default router;
