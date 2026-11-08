// Dedicated local preview port, so it does not open another project's port 3000.
process.env.NODE_ENV = "production";
process.env.PORT ||= "3001";
process.env.APP_URL = `http://localhost:${process.env.PORT}`;
await import("../dist/server.cjs");
