// socket.io types

export type ServerToClientEvents = {
  connectSuccess: (
    servers: RTCIceServer[],
    users: User[],
    messages: Message[]
  ) => void;
  initializedSession: (user: User) => void;
  disconnect: () => void;
  error: (error: string) => void;
};

export type ClientToServerEvents = {
  hello: () => void;
};

// app types

export type User = {
  socketId: string;
  username: string;
};

export type Message = {
  username: string;
  message: string;
};

export type Stream = {
  socketId: string;
  stream: MediaStream;
  spot: number;
};

export type Connection = {
  socketId: string;
  connection: RTCPeerConnection;
};
