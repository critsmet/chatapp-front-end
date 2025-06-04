import { io, Socket } from "socket.io-client";

import type { ServerToClientEvents, ClientToServerEvents } from "./types";

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  process.env.NODE_ENV === "production"
    ? "https://chatapp-back-end.onrender.com"
    : "http://localhost:4001"
);

export default socket;
