import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./my-app/src/routers/authRouter.js";
import userRouter from "./my-app/src/routers/userRouter.js";

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

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
