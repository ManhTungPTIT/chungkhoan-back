import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./src/routers/authRouter.js";
import userRouter from "./src/routers/userRouter.js";
import { buildAllowedOrigins } from "./src/untils/corsOrigins.js";

const app = express();
// Gồm cả origin của app native (capacitor://localhost, https://localhost) —
// xem src/untils/corsOrigins.js.
app.use(
  cors({
    origin: buildAllowedOrigins(),
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;
