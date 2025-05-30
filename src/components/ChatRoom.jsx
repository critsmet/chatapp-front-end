import { useState, useEffect, useRef } from "react";

import VideoStream from "./VideoStream";

import cameraIcon from "../assets/video.png";

const ChatRoom = ({
  socket,
  clientUser,
  users,
  messages,
  streams,
  clientStream,
  openSpots,
  setStreams,
  setOpenSpots,
  broadcasterConnections,
}) => {
  const [message, changeMessage] = useState("");
  const [clicked, toggleClicked] = useState(false);

  const messagesContainerRef = useRef();

  useEffect(() => {
    messagesContainerRef.current.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    socket.emit("sentMessage", message);
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
    let streamToBeRemoved;
    setStreams(
      streams.filter((stream) => {
        if (stream.socketId !== socket.id) {
          return true;
        } else {
          streamToBeRemoved = stream;
          streamToBeRemoved.stream.getTracks().forEach((track) => track.stop());
          return false;
        }
      })
    );
    setOpenSpots([...openSpots, streamToBeRemoved && streamToBeRemoved.spot]);
    socket.emit("endBroadcast");
  };

  const renderStream = (spot) => {
    let stream = streams.find((obj) => obj.spot === spot);
    if (stream) {
      let streamer = [...users, clientUser].find(
        (user) => user.socketId === stream.socketId
      );
      let isClient = streamer.socketId === clientUser.socketId;
      return (
        <VideoStream
          key={spot}
          streamObj={stream}
          streamer={streamer}
          isClient={isClient}
        />
      );
    } else {
      return null;
    }
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
