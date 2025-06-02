import { useEffect, useState, useRef } from "react";

import Signin from "./SignIn";
import ChatRoom from "./ChatRoom";

import socket from "../socket.js";

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [clientUser, setClientUser] = useState({});
  const [users, setUsers] = useState([]);
  const [initialMessages, setInitialMessages] = useState([]);

  let iceServers = useRef(null);

  useEffect(() => {
    socket.on("disconnect", onDisconnect);
    socket.on("error", onError);
    socket.on("connected", onConnected);
    socket.on("initializedSession", onInitializedSession);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("error", onError);
      socket.off("connected", onConnected);
      socket.off("initializedSession", onInitializedSession);
    };
  }, []);

  const onDisconnect = () => setIsConnected(false);

  const onError = (error) => alert(error);

  const onConnected = (servers, users, messages) => {
    iceServers.current = servers;
    setUsers(users);
    setInitialMessages(messages);
    setIsConnected(true);
  };

  const onInitializedSession = (user) => {
    setClientUser(user);
  };

  return (
    <div id="app" className={"fl w-100 pa2"}>
      {!clientUser.username || !isConnected ? (
        <Signin socket={socket} users={users} isConnected={isConnected} />
      ) : (
        <ChatRoom
          socket={socket}
          clientUser={clientUser}
          users={users}
          initialMessages={initialMessages}
          iceServers={iceServers}
        />
      )}
    </div>
  );
};

export default App;
