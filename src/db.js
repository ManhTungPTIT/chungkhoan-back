import dns from "dns";
import mongoose from "mongoose";

// Node's c-ares resolver can fail to detect Windows DNS servers and fall back
// to 127.0.0.1, which breaks the SRV lookup required by mongodb+srv:// URIs.
if (dns.getServers().every((s) => s === "127.0.0.1" || s === "::1")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

export async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}
