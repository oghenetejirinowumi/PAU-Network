import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./realtime/socket.js";

const httpServer = createServer(createApp());
initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`PAU Network API listening on http://localhost:${env.PORT}/api/v1`);
});
