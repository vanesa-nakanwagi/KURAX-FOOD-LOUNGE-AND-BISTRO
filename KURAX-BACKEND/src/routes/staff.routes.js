import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getMyStaffProfile } from "../controllers/staff.controller.js";

const router = express.Router();

router.get("/me", requireAuth, getMyStaffProfile);

export default router;
