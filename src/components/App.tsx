import { useEffect, useState, useRef } from "react";

import Signin from "./SignIn";
import ChatRoom from "./ChatRoom";

import socket from "../socket";

import type { User, Message } from "../types";

const App = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [clientUser, setClientUser] = useState<User>({
    socketId: "",
    username: "",
  });
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const iceServers = useRef<RTCIceServer[]>([]);

  useEffect(() => {
    socket.on("connectSuccess", onConnectSuccess);
    socket.on("initializedSession", onInitializedSession);
    socket.on("disconnect", onDisconnect);
    socket.on("error", onError);
    return () => {
      socket.off("connectSuccess", onConnectSuccess);
      socket.off("initializedSession", onInitializedSession);
      socket.off("disconnect", onDisconnect);
      socket.off("error", onError);
    };
  }, []);

  const onConnectSuccess = (
    servers: RTCIceServer[],
    users: User[],
    messages: Message[]
  ) => {
    iceServers.current = servers;
    setUsers(users);
    setMessages(messages);
    setIsConnected(true);
  };

  const onInitializedSession = (user: User) => {
    setClientUser(user);
  };

  const onDisconnect = () => setIsConnected(false);

  const onError = (error: string) => alert(error);

  return (
    <div id="app" className={"fl w-100 pa2"}>
      {!clientUser.username || !isConnected ? (
        <Signin users={users} isConnected={isConnected} />
      ) : (
        <ChatRoom
          clientUser={clientUser}
          users={users}
          setUsers={setUsers}
          messages={messages}
          setMessages={setMessages}
          iceServers={iceServers.current}
        />
      )}
    </div>
  );
};

export default App;
