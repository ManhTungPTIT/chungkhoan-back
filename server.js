import app from "./app.js";
import { connectDB } from "./src/db.js";
import "dotenv/config";


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
