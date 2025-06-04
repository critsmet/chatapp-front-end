import {
  useState,
  useEffect,
  useRef,
  type SetStateAction,
  type Dispatch,
  type FormEvent,
} from "react";
import { Socket } from "socket.io-client";

import VideoStream from "./VideoStream";

import Constants from "../constants.js";
import type { Stream, Message, User, Connection } from "../types.js";

import cameraIcon from "../assets/video.png";

const ChatRoom = ({
  socket,
  clientUser,
  users,
  setUsers,
  messages,
  setMessages,
  iceServers,
}: {
  socket: Socket;
  clientUser: User;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  iceServers: RTCIceServer[];
}) => {
  const broadcasterConnections = useRef<Connection[]>([]);
  const watcherConnections = useRef<Connection[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [message, changeMessage] = useState("");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [openSpots, setOpenSpots] = useState([1, 2, 3, 4]);
  const [clicked, toggleClicked] = useState(false);
  const clientStream = streams.find((stream) => stream.socketId === socket.id);

  useEffect(() => {
    socket.on("newMessage", onNewMessage);
    socket.on("userLogout", onUserLogoout);
    socket.on("answer", onAnswer);
    socket.on("candidate", onCandidate);
    socket.on("broadcastEnded", onBroadcastEnded);
    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("userLogout", onUserLogoout);
      socket.off("answer", onAnswer);
      socket.off("candidate", onCandidate);
      socket.off("broadcastEnded", onBroadcastEnded);
    };
  }, []);

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current?.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    socket.on("userJoin", onUserJoin);
    return () => {
      socket.off("userJoin", onUserJoin);
    };
  }, [clientStream]);

  useEffect(() => {
    socket.on("offer", onOffer);
    return () => {
      socket.off("offer", onOffer);
    };
  }, [openSpots]);

  useEffect(() => {
    socket.on("broadcastRequestResponse", onBroadcastRequestResponse);
    return () => {
      socket.off("broadcastRequestResponse", onBroadcastRequestResponse);
    };
  }, [users, openSpots]);

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    socket.emit("sendMessage", message);
    changeMessage("");
  };

  const toggleBroadcast = () => {
    if (clicked && clientStream) {
      endBroadcast();
      toggleClicked(false);
    } else if (clicked && !clientStream) {
      return null;
    } else {
      toggleClicked(true);
      socket.emit("requestBroadcast");
    }
  };

  const endBroadcast = () => {
    broadcasterConnections.current.forEach((connectionObj) =>
      connectionObj.connection.close()
    );
    broadcasterConnections.current = [];
    removeStream(clientUser.socketId);
    socket.emit("endBroadcast");
  };

  const onNewMessage = (message: Message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const onUserLogoout = (user: User) => {
    console.log("user logout");
    removeStream(user.socketId);
    closeWatcherConnection(user.socketId);
    closeBroadcasterConnection(user.socketId);
  };

  const onUserJoin = (user: User) => {
    setUsers((prevUsers: User[]) => [...prevUsers, user]);
    if (clientStream) {
      createOffer(user, clientStream.stream);
    }
  };

  const onBroadcastRequestResponse = async ({
    approved,
  }: {
    approved: boolean;
  }) => {
    if (approved) {
      const stream = await navigator.mediaDevices.getUserMedia(
        Constants.VIDEO_CONSTRAINTS
      );
      setStreams((prevStreams) => [
        ...prevStreams,
        {
          socketId: socket.id as string,
          stream,
          spot: openSpots[0],
        },
      ]);
      setOpenSpots((prevSpots) => prevSpots.slice(1));
      users.forEach((user) => createOffer(user, stream));
    } else {
      alert("Max amount of videos broadcasted");
    }
  };

  const onBroadcastEnded = (socketId: string) => {
    console.log("on broadcast ended");
    if (socketId !== clientUser.socketId) {
      console.log("shouldnt get here");
      closeWatcherConnection(socketId);
      removeStream(socketId);
    }
  };

  const onOffer = (
    socketId: string,
    description: RTCSessionDescriptionInit
  ) => {
    let newRemotePeerConnection = new RTCPeerConnection({
      iceServers,
    });
    createAnswer(newRemotePeerConnection, socketId, description);
    getStream(newRemotePeerConnection, socketId);
  };

  const onAnswer = (
    socketId: string,
    description: RTCSessionDescriptionInit
  ) => {
    let foundConnectionObj = broadcasterConnections.current.find(
      (connectionObj) => connectionObj.socketId === socketId
    );
    if (foundConnectionObj) {
      foundConnectionObj.connection.setRemoteDescription(description);
    }
  };

  const onCandidate = (socketId: string, candidate: RTCIceCandidate) => {
    let foundConnectionObj = broadcasterConnections.current.find(
      (connectionObj) => connectionObj.socketId === socketId
    );
    if (foundConnectionObj) {
      foundConnectionObj.connection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    }
  };

  const createAnswer = async (
    connection: RTCPeerConnection,
    socketId: string,
    description: RTCSessionDescriptionInit
  ) => {
    watcherConnections.current = [
      ...watcherConnections.current,
      {
        socketId,
        connection: connection,
      },
    ];
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", socketId, "fromWatcher", event.candidate);
      }
    };
    await connection.setRemoteDescription(description);
    const sdp = await connection.createAnswer();
    await connection.setLocalDescription(sdp);
    socket.emit("answer", socketId, connection.localDescription);
  };

  const createOffer = async (user: User, stream: MediaStream) => {
    const newLocalPeerConnection = new RTCPeerConnection({
      iceServers: iceServers,
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

  const closeWatcherConnection = (socketId: string) => {
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

  const closeBroadcasterConnection = (socketId: string) => {
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

  const getStream = (connection: RTCPeerConnection, socketId: string) => {
    connection.ontrack = (event) => {
      if (event.track.kind === "video") {
        setStreams((prevStreams) => [
          ...prevStreams,
          {
            socketId,
            stream: event.streams[0],
            spot: openSpots[0],
          },
        ]);
      }
    };
  };

  const removeStream = (socketId: string) => {
    const streamToBeRemoved = streams.find(
      (stream) => stream.socketId === socketId
    );
    if (streamToBeRemoved) {
      streamToBeRemoved.stream.getTracks().forEach((track) => track.stop());
      setStreams((prevStreams) => {
        return prevStreams.filter((stream) => {
          if (stream.socketId !== socketId) {
            return true;
          } else {
            return false;
          }
        });
      });
      setOpenSpots((prevOpenSpots) => [
        ...prevOpenSpots,
        streamToBeRemoved.spot,
      ]);
    }
  };

  const renderStream = (spot: number) => {
    let stream = streams.find((obj) => obj.spot === spot);
    if (stream) {
      let streamer = [...users, clientUser].find(
        (user) => user.socketId === stream.socketId
      );
      if (streamer) {
        let isClient = streamer.socketId === clientUser.socketId;
        return (
          <VideoStream
            key={spot}
            streamObj={stream}
            user={streamer}
            isClient={isClient}
          />
        );
      }
    }
    return null;
  };

  const renderMessages = () => {
    return messages.map((message, idx) => {
      return (
        <div className="ma2 br2" key={message.message + `${idx}`}>
          {" "}
          {message.username}: {message.message}
        </div>
      );
    });
  };

  return (
    <div id="chatroom-container" className="h-100 w-100 helvetica">
      <div id="chatroom" className="h-100 w-100 flex pa4">
        <div id="column-1" className="flex-column w-third">
          <div id="square1" className="w-100 h-50 mt3 ">
            {renderStream(1)}
          </div>
          <div id="square2" className="w-100 h-50 mb3 mb6">
            {renderStream(4)}
          </div>
        </div>
        <div
          id="column-2"
          className="w-third h-100 flex flex-column-reverse pb4"
        >
          <form
            id="message-input-field"
            onSubmit={handleSend}
            className="flex items-center justify-around h-10"
          >
            <img
              src={cameraIcon}
              alt="toggle camera"
              className={`w-auto pt2 h2 pointer${clicked ? " o-40" : ""}`}
              onClick={toggleBroadcast}
            />
            <input
              onChange={(e) => changeMessage(e.target.value)}
              value={message}
              placeholder="say something..."
              className="dib bg-washed-yellow w-60 h2 f4"
              spellCheck="false"
            />
            <input
              type="submit"
              value="send"
              className="dib w3 h2 br-pill white bg-dark-gray bg-animate hover-bg-mid-gray pointer tc f5"
            />
          </form>
          <div
            id="messages-container"
            ref={messagesContainerRef}
            className="mb3 pl4 pr4 flex h-auto flex-column-reverse overflow-y-scroll tl"
          >
            {renderMessages().reverse()}
          </div>
        </div>
        <div id="column-3" className="flex-column w-third">
          <div id="square3" className="w-100 h-50 mt3 ">
            {renderStream(3)}
          </div>
          <div id="square4" className="w-100 h-50 mb3 mb6">
            {renderStream(2)}
          </div>
        </div>
      </div>
      <div id="usernames-container" className="bg-washed-yellow mt5 tl f3">
        {users.length
          ? users.map((user) => (
              <p className="dib ma1" key={user.username}>
                {user.username}
              </p>
            ))
          : `no one's here but you, ${clientUser.username}`}
      </div>
    </div>
  );
};

export default ChatRoom;
