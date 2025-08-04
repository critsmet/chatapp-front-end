import {
  useState,
  useEffect,
  useRef,
  type SetStateAction,
  type Dispatch,
  type FormEvent,
} from "react";

import VideoStream from "./VideoStream";

import Constants from "../constants";
import socket from "../socket";
import type { Stream, Message, User, Connection } from "../types";

import cameraIcon from "../assets/video.png";

const ChatRoom = ({
  clientUser,
  users,
  setUsers,
  messages,
  setMessages,
  iceServers,
}: {
  clientUser: User;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  iceServers: RTCIceServer[];
}) => {
  const peerConnections = useRef<Connection[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [message, changeMessage] = useState("");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [openSpots, setOpenSpots] = useState([1, 2, 3, 4]);
  const [clicked, toggleClicked] = useState(false);
  const clientStream = streams.find((stream) => stream.socketId === socket.id);

  useEffect(() => {
    const onNewMessage = (message: Message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const onUserLogout = (user: User) => {
      removeStream(user.socketId);
      closePeerConnection(user.socketId);
    };

    const onAnswer = (socketId: string, description: RTCSessionDescription) => {
      const foundConnectionObj = peerConnections.current.find(
        (connectionObj) => connectionObj.socketId === socketId
      );
      if (foundConnectionObj) {
        try {
          foundConnectionObj.connection.setRemoteDescription(description);
        } catch (error) {
          console.error("Failed to set remote description:", error);
        }
      }
    };

    const onCandidate = (socketId: string, candidate: RTCIceCandidate) => {
      const foundConnectionObj = peerConnections.current.find(
        (connectionObj) => connectionObj.socketId === socketId
      );
      if (foundConnectionObj) {
        try {
          foundConnectionObj.connection.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error("Failed to add ICE candidate:", error);
        }
      }
    };

    const onBroadcastEnded = (socketId: string) => {
      if (socketId !== clientUser.socketId) {
        removeStream(socketId);
      }
    };

    socket.on("newMessage", onNewMessage);
    socket.on("userLogout", onUserLogout);
    socket.on("answer", onAnswer);
    socket.on("candidate", onCandidate);
    socket.on("broadcastEnded", onBroadcastEnded);

    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("userLogout", onUserLogout);
      socket.off("answer", onAnswer);
      socket.off("candidate", onCandidate);
      socket.off("broadcastEnded", onBroadcastEnded);
    };
  }, [clientUser.socketId]);

  useEffect(() => {
    const onUserJoin = (user: User) => {
      setUsers((prevUsers: User[]) => [...prevUsers, user]);
      createPeerConnection(user);
    };

    socket.on("userJoin", onUserJoin);
    return () => {
      socket.off("userJoin", onUserJoin);
    };
  }, [iceServers]);

  useEffect(() => {
    const onOffer = async (
      socketId: string,
      description: RTCSessionDescriptionInit
    ) => {
      // Find existing connection or create new one
      let connectionObj = peerConnections.current.find(
        (conn) => conn.socketId === socketId
      );

      if (!connectionObj) {
        const newConnection = createPeerConnection({ socketId } as User);
        connectionObj = newConnection;
      }

      try {
        await connectionObj.connection.setRemoteDescription(description);
        const answer = await connectionObj.connection.createAnswer();
        await connectionObj.connection.setLocalDescription(answer);

        socket.emit(
          "answer",
          socketId,
          connectionObj.connection.localDescription as RTCSessionDescription
        );
      } catch (error) {
        console.error("Failed to handle offer:", error);
      }
    };

    socket.on("offer", onOffer);
    return () => {
      socket.off("offer", onOffer);
    };
  }, [iceServers]);

  useEffect(() => {
    const onBroadcastRequestResponse = async ({
      approved,
    }: {
      approved: boolean;
    }) => {
      if (approved) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(
            Constants.VIDEO_CONSTRAINTS
          );

          localStreamRef.current = stream;

          setStreams((prevStreams) => [
            ...prevStreams,
            {
              socketId: socket.id as string,
              stream,
              spot: openSpots[0],
            },
          ]);
          setOpenSpots((prevSpots) => prevSpots.slice(1));

          addStreamToAllConnections(stream);
        } catch (error) {
          console.error("Failed to get user media:", error);
          alert("Camera access denied or not available");
        }
      } else {
        alert("Max amount of videos broadcasted");
      }
    };

    socket.on("broadcastRequestResponse", onBroadcastRequestResponse);
    return () => {
      socket.off("broadcastRequestResponse", onBroadcastRequestResponse);
    };
  }, [openSpots]);

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current?.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const createPeerConnection = (user: User): Connection => {
    const existingConnection = peerConnections.current.find(
      (conn) => conn.socketId === user.socketId
    );
    if (existingConnection) {
      return existingConnection;
    }

    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.onnegotiationneeded = async () => {
      try {
        console.log(`Negotiation needed with ${user.socketId}`);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit(
          "offer",
          user.socketId,
          peerConnection.localDescription as RTCSessionDescription
        );
      } catch (error) {
        console.error(`Negotiation failed with ${user.socketId}:`, error);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${user.socketId}: ${peerConnection.connectionState}`
      );
      if (peerConnection.connectionState === "failed") {
        console.error(`Connection failed with user: ${user.socketId}`);
      }
    };

    peerConnection.oniceconnectionstatechange = async () => {
      try {
        const stats = await peerConnection.getStats();

        stats.forEach((report) => {
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            console.log(
              `Connection Type: ${
                report.priority > 2000000000
                  ? "🏠 DIRECT (Host-to-Host)"
                  : report.priority > 1000000000
                    ? "🔄 NAT TRAVERSAL (STUN)"
                    : "🔄 RELAYED (TURN Server)"
              }`
            );
            console.log(`Local Candidate: ${report.localCandidateId}`);
            console.log(`Remote Candidate: ${report.remoteCandidateId}`);
            console.log(
              `Round Trip Time: ${report.currentRoundTripTime || "N/A"}ms`
            );
          }
        });
      } catch (error) {
        console.error(`Failed to get stats`, error);
      }
    };

    peerConnection.onicecandidate = (event) => {
      // Log the ICE candidate details
      console.log(`ICE Candidate for ${user.socketId}:`, {
        type: event?.candidate?.type,
        protocol: event?.candidate?.protocol,
        address: event?.candidate?.address,
        port: event?.candidate?.port,
        priority: event?.candidate?.priority,
        foundation: event?.candidate?.foundation,
        component: event?.candidate?.component,
        candidateString: event?.candidate?.candidate,
      });

      if (event.candidate) {
        socket.emit("candidate", user.socketId, event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      if (event.track.kind === "video") {
        setOpenSpots((currentOpenSpots) => {
          const spotToUse = currentOpenSpots[0];
          setStreams((prevStreams) => {
            const existingStreamIndex = prevStreams.findIndex(
              (stream) => stream.socketId === user.socketId
            );

            if (existingStreamIndex >= 0) {
              const newStreams = [...prevStreams];
              newStreams[existingStreamIndex] = {
                ...newStreams[existingStreamIndex],
                stream: event.streams[0],
              };
              return newStreams;
            } else {
              return [
                ...prevStreams,
                {
                  socketId: user.socketId,
                  stream: event.streams[0],
                  spot: spotToUse,
                },
              ];
            }
          });

          const existingStream = streams.find(
            (s) => s.socketId === user.socketId
          );
          return existingStream ? currentOpenSpots : currentOpenSpots.slice(1);
        });
      }
    };

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        peerConnection.addTrack(track, localStreamRef.current);
      }
    }

    const connectionObj = {
      socketId: user.socketId,
      connection: peerConnection,
    };

    peerConnections.current = [...peerConnections.current, connectionObj];
    return connectionObj;
  };

  const addStreamToAllConnections = (stream: MediaStream) => {
    peerConnections.current.forEach((connectionObj) => {
      const senders = connectionObj.connection.getSenders();
      senders.forEach((sender) => {
        if (sender.track) {
          connectionObj.connection.removeTrack(sender);
        }
      });

      for (const track of stream.getTracks()) {
        connectionObj.connection.addTrack(track, stream);
      }
    });
  };

  const removeStreamFromAllConnections = (stream: MediaStream) => {
    peerConnections.current.forEach((connectionObj) => {
      const senders = connectionObj.connection.getSenders();
      senders.forEach((sender) => {
        if (sender.track && stream.getTracks().includes(sender.track)) {
          connectionObj.connection.removeTrack(sender);
        }
      });
    });
  };

  const closePeerConnection = (socketId: string) => {
    peerConnections.current = peerConnections.current.filter(
      (connectionObj) => {
        if (connectionObj.socketId !== socketId) {
          return true;
        } else {
          connectionObj.connection.ontrack = null;
          connectionObj.connection.onicecandidate = null;
          connectionObj.connection.onconnectionstatechange = null;
          connectionObj.connection.oniceconnectionstatechange = null;
          connectionObj.connection.onnegotiationneeded = null;
          connectionObj.connection.close();
          return false;
        }
      }
    );
  };

  const removeStream = (socketId: string) => {
    const streamToBeRemoved = streams.find(
      (stream) => stream.socketId === socketId
    );
    if (streamToBeRemoved) {
      streamToBeRemoved.stream.getTracks().forEach((track) => track.stop());
      setStreams((prevStreams) => {
        return prevStreams.filter((stream) => stream.socketId !== socketId);
      });
      setOpenSpots((prevOpenSpots) => [
        ...prevOpenSpots,
        streamToBeRemoved.spot,
      ]);
    }
  };

  const endBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      removeStreamFromAllConnections(localStreamRef.current);

      localStreamRef.current = null;
    }

    removeStream(clientUser.socketId);
    socket.emit("endBroadcast");
  };

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

  const renderStream = (spot: number) => {
    const stream = streams.find((obj) => obj.spot === spot);
    if (stream) {
      const streamer = [...users, clientUser].find(
        (user) => user.socketId === stream.socketId
      );
      if (streamer) {
        const isClient = streamer.socketId === clientUser.socketId;
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
