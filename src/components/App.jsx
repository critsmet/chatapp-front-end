import { useEffect, useState, useRef } from "react";

import Signin from "./SignIn";
import ChatRoom from "./ChatRoom";

import socket from "../socket.js";

const App = () => {
  const broadcasterConnections = useRef([]);
  const watcherConnections = useRef([]);
  let iceServers = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [clientUser, setClientUser] = useState({});
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streams, setStreams] = useState([]);
  const [openSpots, setOpenSpots] = useState([1, 2, 3, 4]);
  const clientStream = streams.find((stream) => stream.socketId === socket.id);

  socket.connect();

  useEffect(() => {
    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("error", (error) => {
      console.log("socket error", error);
    });

    socket.on("connected", (servers, users) => {
      iceServers.current = servers;
      setUsers(users);
      setIsConnected(true);
    });

    socket.on("initializedSession", (user, messages) => {
      setClientUser(user);
      setMessages(messages);
    });

    socket.on("offer", (socketId, description) => {
      const stream = createAnswer(socketId, description);
      if (stream) {
        setStreams((currentStreams) => [...currentStreams, stream]);
      }
    });

    socket.on("answer", (socketId, description) => {
      let foundConnectionObj = broadcasterConnections.current.find(
        (connectionObj) => connectionObj.socketId === socketId
      );
      if (foundConnectionObj) {
        foundConnectionObj.connection.setRemoteDescription(description);
      }
    });

    socket.on("candidate", (socketId, sender, candidate) => {
      let foundConnectionObj = (
        sender === "fromWatcher"
          ? broadcasterConnections.current
          : watcherConnections.current
      ).find((connectionObj) => connectionObj.socketId === socketId);
      if (foundConnectionObj) {
        foundConnectionObj.connection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    });
  }, []);

  useEffect(() => {
    socket.on("newMessage", (message) => {
      setMessages([...messages, message]);
    });
  }, [messages]);

  useEffect(() => {
    socket.on("broadcastEnded", (socketId) => {
      closeWatcherConnection(socketId);
      let streamToBeRemoved;
      setStreams(
        streams.filter((stream) => {
          if (stream.socketId !== clientUser.socketId) {
            return true;
          } else {
            streamToBeRemoved = stream;
            streamToBeRemoved.stream
              .getTracks()
              .forEach((track) => track.stop());
            return false;
          }
        })
      );
      setOpenSpots([...openSpots, streamToBeRemoved && streamToBeRemoved.spot]);
    });

    socket.on("userLogout", (user) => {
      let streamToBeRemoved;
      setStreams(
        streams.filter((stream) => {
          if (stream.socketId !== user.socketId) {
            return true;
          } else {
            streamToBeRemoved = stream;
            streamToBeRemoved.stream
              .getTracks()
              .forEach((track) => track.stop());
            return false;
          }
        })
      );
      closeWatcherConnection(user.socketId);
      closeBroadcasterConnection(user.socketId);
      setOpenSpots([...openSpots, streamToBeRemoved && streamToBeRemoved.spot]);
    });
  }, [streams, openSpots]);

  useEffect(() => {
    socket.on("newUserJoin", (user) => {
      setUsers([...users, user]);
      if (clientStream) {
        createOffer(user, clientStream.stream, broadcasterConnections);
      }
    });
    return () => socket.off("newUserJoin");
  }, [clientStream]);

  useEffect(() => {
    socket.on("broadcastRequestResponse", async (response, users) => {
      const constraints = {
        audio: true,
        video: {
          facingMode: "user",
          width: {
            exact: 620,
          },
          height: {
            exact: 480,
          },
        },
      };
      if (response.approved) {
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        setStreams([
          ...streams,
          {
            socketId: socket.id,
            stream,
            spot: openSpots[0],
          },
        ]);
        setOpenSpots(openSpots.slice(1));
        users.forEach((user) => createOffer(user, stream));
      } else {
        alert("Max amount of videos broadcasted");
      }
    });
    return () => socket.off("broadcastRequestResponse");
  }, [users, clientStream]);

  const createAnswer = async (socketId, description) => {
    let stream;
    let newRemotePeerConnection = new RTCPeerConnection({
      iceServers: iceServers.current,
    });
    watcherConnections.current = [
      ...watcherConnections.current,
      {
        socketId,
        connection: newRemotePeerConnection,
      },
    ];
    newRemotePeerConnection.ontrack = (event) => {
      if (event.track.kind === "video") {
        stream = {
          socketId,
          stream: event.streams[0],
          spot: openSpots[0],
        };
      }
    };
    newRemotePeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", socketId, "fromWatcher", event.candidate);
      }
    };
    await newRemotePeerConnection.setRemoteDescription(description);
    const sdp = await newRemotePeerConnection.createAnswer();
    await newRemotePeerConnection.setLocalDescription(sdp);
    socket.emit("answer", socketId, newRemotePeerConnection.localDescription);
    return stream;
  };

  const createOffer = async (user, stream) => {
    const newLocalPeerConnection = new RTCPeerConnection({
      iceServers: iceServers.current,
    });
    broadcasterConnections.current = [
      ...broadcasterConnections.current,
      { socketId: user.socketId, connection: newLocalPeerConnection },
    ];
    for (const track of stream.getTracks()) {
      newLocalPeerConnection.addTrack(track, stream);
    }
    newLocalPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(
          "candidate",
          user.socketId,
          "fromBroadcaster",
          event.candidate
        );
      }
    };

    const sdp = await newLocalPeerConnection.createOffer();
    await newLocalPeerConnection.setLocalDescription(sdp);
    socket.emit(
      "offer",
      user.socketId,
      newLocalPeerConnection.localDescription
    );
  };

  const closeWatcherConnection = (socketId) => {
    watcherConnections.current = watcherConnections.current.filter(
      (connectionObj) => {
        if (connectionObj.socketId !== socketId) {
          return true;
        } else {
          connectionObj.connection.close();
          return false;
        }
      }
    );
  };

  const closeBroadcasterConnection = (socketId) => {
    broadcasterConnections.current = broadcasterConnections.current.filter(
      (connectionObj) => {
        if (connectionObj.socketId !== socketId) {
          return true;
        } else {
          connectionObj.connection.close();
          return false;
        }
      }
    );
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
          messages={messages}
          streams={streams}
          clientStream={clientStream}
          openSpots={openSpots}
          setStreams={setStreams}
          setOpenSpots={setOpenSpots}
          broadcasterConnections={broadcasterConnections}
        />
      )}
    </div>
  );
};

export default App;
