import express from "express";
import cors from "cors";

import staffRoutes from "./routes/staff.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/staff", staffRoutes);

export default app;
