import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { connectDB } from "./src/db.js";


async function startServer() {
  try {
    await connectDB();
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
