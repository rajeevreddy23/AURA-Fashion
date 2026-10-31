// Serve the built application consistently on Windows, macOS and Linux.
process.env.NODE_ENV = "production";
await import("../dist/server.cjs");
