import { useEffect, useState, useRef } from "react";

import Signin from "./SignIn";
import ChatRoom from "./ChatRoom";

import socket from "../socket.js";

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [clientUser, setClientUser] = useState({});
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  let iceServers = useRef(null);

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

  const onConnectSuccess = (servers, users, messages) => {
    iceServers.current = servers;
    setUsers(users);
    setMessages(messages);
    setIsConnected(true);
  };

  const onInitializedSession = (user) => {
    setClientUser(user);
  };

  const onDisconnect = () => setIsConnected(false);

  const onError = (error) => alert(error);

  return (
    <div id="app" className={"fl w-100 pa2"}>
      {!clientUser.username || !isConnected ? (
        <Signin socket={socket} users={users} isConnected={isConnected} />
      ) : (
        <ChatRoom
          socket={socket}
          clientUser={clientUser}
          users={users}
          setUsers={setUsers}
          messages={messages}
          setMessages={setMessages}
          iceServers={iceServers}
        />
      )}
    </div>
  );
};

export default App;
