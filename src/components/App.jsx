import { useEffect, useState, useRef } from "react"

import Signin from "./SignIn"
import ChatRoom from "./ChatRoom"

import socket from '../socket.js'

const App = () => {
  const broadcasterConnections = useRef([]);
  const watcherConnections = useRef([]);
  let iceServersConfig = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [clientUser, setClientUser] = useState({});
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streams, setStreams] = useState([]);
  const [openSpots, setOpenSpots] = useState([1, 2, 3, 4]);
  const clientStream = streams.find(stream => stream.socketId === socket.id)

  socket.connect();
  useEffect(() => {
    socket.on("disconnect", () => {
      setIsConnected(false)
    });

    socket.on("error", (error) => {
      console.log('socket error', error)
    });

    socket.on("connected", (iceServers, users) => {
      iceServersConfig.current = iceServers
      setUsers(users)
      setIsConnected(true)
    });

    socket.on("initializedSession", (user, messages) => {
      setClientUser(user);
      setMessages(messages);
    });

    socket.on("offer", (socketId, description) => createAnswer(socketId, description));

    socket.on("answer", (socketId, description) => {
      let foundConnectionObj = broadcasterConnections.current.find(connectionObj => connectionObj.socketId === socketId)
      foundConnectionObj && foundConnectionObj.connection.setRemoteDescription(description)
    });

    socket.on("candidate", addCandidate)
    
  }, []);

  useEffect(() => {
    socket.on("newMessage", message => {
      setMessages([...messages, message])
    });
  }, [messages])

  useEffect(() => {
    socket.on("broadcastEnded", (socketId) => {
      closeWatcherConnection(socketId)
      let streamToBeRemoved;
      setStreams(streams.filter(stream => {
        if(stream.socketId !== user.socketId){
          return true
        } else {
          streamToBeRemoved = stream
          streamToBeRemoved.stream.getTracks().forEach(track => track.stop())
          return false
        }
      }));
      setOpenSpots([...openSpots, streamToBeRemoved && streamToBeRemoved.spot])
    });

    socket.on("userLogout", user => {
      let streamToBeRemoved;
      setStreams(streams.filter(stream => {
        if(stream.socketId !== user.socketId){
          return true
        } else {
          streamToBeRemoved = stream
          streamToBeRemoved.stream.getTracks().forEach(track => track.stop())
          return false
        }
      }));
      closeWatcherConnection(user.socketId)
      closeBroadcasterConnection(user.socketId)
      setOpenSpots([...openSpots, streamToBeRemoved && streamToBeRemoved.spot])
    });
  }, [streams, openSpots])

  useEffect(() => {
    socket.on("newUserJoin", (user) => {
      setUsers([...users, user])
      clientStream && createOffer(user, clientStream.stream)
    })
    return () => socket.off("newUserJoin")
  }, [clientStream])

  useEffect(() => {
    socket.on("broadcastRequestResponse", handleBroadcastRequestResponse)
    return () => socket.off("broadcastRequestResponse")
  }, [users, clientStream])

  const handleBroadcastRequestResponse = (response) => {
    if (response.approved){
      const constraints = { audio: true, video: { facingMode: "user", width: { exact: 620 }, height: { exact: 480 } }}
      navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        setStreams([
          ...streams, {
            socketId: socket.id, 
            stream,
            spot: openSpots[0]
          }
        ])
        setOpenSpots(openSpots.slice(1))
        users.forEach((user) => createOffer(user, stream))
      })
    } else {
       alert("Max amount of videos broadcasted")
     }
   }

  const createAnswer = (socketId, description) => {
    let newRemotePeerConnection = new RTCPeerConnection({iceServers: iceServersConfig.current})
    watcherConnections.current = [...watcherConnections.current, {socketId, connection: newRemotePeerConnection}]
    newRemotePeerConnection.ontrack = event => {
      if (event.track.kind === "video"){
        setStreams((currentStreams => [
          ...currentStreams, {
            socketId, 
            stream: event.streams[0],
            spot: openSpots[0]
          }
        ]))
      }
    }
    newRemotePeerConnection.onicecandidate = (event) => {
      event.candidate && socket.emit("candidate", socketId, "fromWatcher", event.candidate)
    }
    newRemotePeerConnection
      .setRemoteDescription(description)
      .then(() => newRemotePeerConnection.createAnswer())
      .then(sdp => newRemotePeerConnection.setLocalDescription(sdp))
      .then(() => socket.emit("answer", socketId, newRemotePeerConnection.localDescription))
  }

  const addCandidate = (socketId, sender, candidate) => {
      let ref = sender === "fromWatcher" ? broadcasterConnections.current : watcherConnections.current
      let foundConnectionObj = ref.find(connectionObj => connectionObj.socketId === socketId)
      foundConnectionObj && foundConnectionObj.connection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  const createOffer = (user, stream) => {
    const newLocalPeerConnection = new RTCPeerConnection({iceServers: iceServersConfig.current})
    broadcasterConnections.current = [...broadcasterConnections.current, {socketId: user.socketId, connection: newLocalPeerConnection}]
    for (const track of stream.getTracks()){
      newLocalPeerConnection.addTrack(track, stream)
    }
    newLocalPeerConnection.onicecandidate = (event) => {
      event.candidate && socket.emit("candidate", user.socketId, "fromBroadcaster", event.candidate)
    }

    newLocalPeerConnection
      .createOffer()
      .then(sdp => newLocalPeerConnection.setLocalDescription(sdp))
      .then(() => socket.emit("offer", user.socketId, newLocalPeerConnection.localDescription))
  }

  const closeWatcherConnection = (socketId) => {
    watcherConnections.current = watcherConnections.current.filter(connectionObj => {
      if (connectionObj.socketId !== socketId){
        return true
      } else {
        connectionObj.connection.close()
        return false
      }
    })
  }

  const closeBroadcasterConnection = (socketId) => {
    broadcasterConnections.current = broadcasterConnections.current.filter(connectionObj => {
      if (connectionObj.socketId !== socketId){
        return true
      } else {
        connectionObj.connection.close()
        return false
      }
    })
  }

  return (
      <div id="app" className={"fl w-100 pa2"}>
        {
          !clientUser.username || !isConnected ?
          <Signin 
            socket={socket} 
            users={users} 
            isConnected={isConnected}
          /> :
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
        }
      </div>
  );
};

export default App;