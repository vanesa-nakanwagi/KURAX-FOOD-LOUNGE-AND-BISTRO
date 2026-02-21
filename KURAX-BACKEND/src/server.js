import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { supabase } from "./config/supabase.js";

const app = express();

// ===== Your test route goes here =====
app.get("/test-supabase", async (req, res) => {
  const { data, error } = await supabase.from("kurax-staff").select("*");
  res.json({ data, error });
});

// ===== You can add other routes here =====

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
