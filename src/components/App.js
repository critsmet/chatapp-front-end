import React, { useEffect, useRef } from "react"

import Signin from "./Signin"
import ChatRoom from "./ChatRoom"

import {useDispatch, useSelector} from "react-redux"

const App = () => {

  const dispatch = useDispatch()
  const serverResponse = useSelector(state => state.serverResponse)
  //the socket connection is created in the initial state in the Redux store
  const socket = useSelector(state => state.socket)
  const user = useSelector(state => state.user)
  const users = useSelector(state => state.users)
  const clientStream = useSelector(state => state.streams.find(stream => stream.socketId === socket.id))

  //because ice candidates start firing immediately, the hooks--even with dependencies--did not update in time
  //although a connection could ultimately be made by the few ice candidates that made it after the hooks succesfully registered the state update,
  //many ice candidates were reaching closed, outdated connections
  //refs return objects and reflect change immediately, without any errors
  const broadcasterConnections = useRef([])
  const watcherConnections = useRef([])

  let iceServersConfig = useRef(null)

  //i had tried in many ways to establish socket listeners and define their callbacks in a separate file, but without access to dispatch and certain state values,
  //it provoed to be challenging. will continue to look for ways to do this.

  //these socket listeners do not require any dependencies and can be determined on component "mounting", so I batched them together
  useEffect(() => {

    socket.on("disconnect", () => dispatch({type: "setServerResponse", payload: false}))

    socket.on("connected", (iceServersArray, usersArray) => {
      //console.log("CONNECTED");
      iceServersConfig.current = iceServersArray
      dispatch({type: "setUsers", payload: usersArray})
      dispatch({type:"setServerResponse", payload: true})
    })

    socket.on("initializedSession", (userObj, messagesArray) => {
      dispatch({type: "setUser", payload: userObj})
      //console.log(messagesArray);
      dispatch({type: "setMessages", payload: messagesArray})
      //console.log(`Yay! You've initialized a session with the username ${userObj.username}!`);
    })

    //we could get away with just receiving the userId or socketId here, but for consistency we'll receive the userObj
    //this method runs when another user logs out
    //currently there is no "sign out" feature, we just expect users to close the window.
    socket.on("userLogout", userObj => {
      //console.log(`${userObj.username} just logged out`);
      dispatch({type: "removeStream", payload: userObj.socketId})
      closeWatcherConnection(userObj.socketId)
      closeBroadcasterConnection(userObj.socketId)
      dispatch({type: "logoutUser", payload: userObj.socketId})
    })

    socket.on("newMessage", messageObj => {
      //pessimistic rendering...maybe not the best idea? let's maybe clean this up later
      //in other words, right now all messages, even ones from the client, go through the server
      //however the speed doesn't seem to be too slow, so let's keep it for now?
      dispatch({type: "newMessage", payload: messageObj})
      //console.log("New message received:", messageObj);
    })

    socket.on("broadcastEnded", (socketId) => {
      //when the broadcast ends, we need to clean up by closing the connection and then ultimately removing the connection from the array
      closeWatcherConnection(socketId)
      dispatch({type: "removeStream", payload: socketId})
    })

    socket.on("offer", (socketId, description) => createAnswer(socketId, description))

    socket.on("answer", (socketId, description) => {
      //console.log("setting remote description");
      let foundConnectionObj = broadcasterConnections.current.find(connectionObj => connectionObj.socketId === socketId)
      //console.log("All Broadcaster Connections!! Did the change?", broadcasterConnections);
      foundConnectionObj && foundConnectionObj.connection.setRemoteDescription(description)
    })

    socket.on("candidate", addCandidate)

    return () => {
      socket.close()
    }
  }, [])

  //these socket listeners have their own unique dependencies, so I return socket.off values and the dependencies in an array
  useEffect(() => {
    //this runs when another user joins that isn't the client
    socket.on("newUserJoin", (userObj) => {
      dispatch({type: "addUser", payload: userObj})
      //only send an offer if there is a clientStream currently
      clientStream && createOffer(userObj, clientStream.stream)
      //console.log(`${userObj.username} just joined!`)
    })
    return () => socket.off("newUserJoin")
  }, [clientStream])

  useEffect(() => {
    socket.on("broadcastRequestResponse", handleBroadcastRequestResponse)
    //console.log(users);
    return () => socket.off("broadcastRequestResponse")
  }, [users, clientStream])

  const handleBroadcastRequestResponse = (response) => {
    //console.log("BRRROAADCCASTTT", "...USERS", users)
    if (response.approved){
      const constraints = { audio: true, video: { facingMode: "user", width: { exact: 620 }, height: { exact: 480 } }}
      //console.log("client stream!", clientStream);
      navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        //console.log("getting stream", stream);
        dispatch({type: "addStream", payload: {socketId: socket.id, stream}})
        //console.log("stream position", streamPos);
        //console.log("About to send offer to each user", users);
        users.forEach((user) => createOffer(user, stream))
      })
    } else {
       alert("Max amount of videos broadcasted")
     }
   }

  const addCandidate = (socketId, sender, candidate) => {
      //console.log("sending candidates", sender);
      let ref = sender === "fromWatcher" ? broadcasterConnections.current : watcherConnections.current
      //console.log(broadcasterConnections, watcherConnections, socketId)
      let foundConnectionObj = ref.find(connectionObj => connectionObj.socketId === socketId)
      //console.log(foundConnectionObj, candidate);
      foundConnectionObj && foundConnectionObj.connection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  const createOffer = (user, stream) => {
    //console.log("Making offer!");
    //Step 1. Make the connection we, the broadcaster, will prepare to send to the watcher
    const newLocalPeerConnection = new RTCPeerConnection({iceServers: iceServersConfig.current})

    //Step 2. Add the connection to our the state's broadcaster connections
    broadcasterConnections.current = [...broadcasterConnections.current, {socketId: user.socketId, connection: newLocalPeerConnection}]
    //console.log(stream);
    //Step 3. Take the stream we've started and add the tracks to the connection
    for (const track of stream.getTracks()){
      newLocalPeerConnection.addTrack(track, stream)
    }

    //Step 4. Prepare the connection to receive ice candidates and forward them to the watcher's connection as well
    newLocalPeerConnection.onicecandidate = (event) => {
      //console.log("The local peer connection (broadcaster) is about to send some candidates to the watcher");
      event.candidate && socket.emit("candidate", user.socketId, "fromBroadcaster", event.candidate)
    }

    //console.log("Sending an offer from broadcaster!");
    //Step 5. Officially create the offer, set the local description, and send the offer through the server
    newLocalPeerConnection
      .createOffer()
      .then(sdp => newLocalPeerConnection.setLocalDescription(sdp))
      .then(() => socket.emit("offer", user.socketId, newLocalPeerConnection.localDescription))
  }

  const createAnswer = (socketId, description) => {
    //console.log("Making an answer");
    //Step 6. Have the watcher make its own peer connection
    let newRemotePeerConnection = new RTCPeerConnection({iceServers: iceServersConfig.current})
    //console.log(iceServersConfig.current);

    //Step 7. Add the connection to our the state's watcher connections
    watcherConnections.current = [...watcherConnections.current, {socketId, connection: newRemotePeerConnection}]
    //console.log("Set watcher connection");

    //Step 8. Because we are the watcher, we wait for the tracks to be added and then add the stream to our streams in state
    //This obviously seems to have happened back when we created the offer, but still works seemingly retroactively
    newRemotePeerConnection.ontrack = event => {
      //only add to streams array after the audio AND visual have been added
      //the first one is always audio, so if we check for video we know both are added
      if (event.track.kind === "video"){
        //the streams have fixed positions, so we change the counter after the stream has been set
        //console.log("GETTING VIDEO");
        dispatch({type: "addStream", payload: {socketId, stream: event.streams[0]}})
      }
    }
    //console.log("BROADCASTER CONNETIONS", broadcasterConnections.current);
    //console.log("WATCHER CONNETIONS", watcherConnections.current);

    //Step 9. Prepare the connection to receive ice candidates and forward them to the broadcasters's connection as well
    newRemotePeerConnection.onicecandidate = (event) => {
      //console.log("The remote peer connection (watcher) is about to send some candidates to the broadcaster");
      event.candidate && socket.emit("candidate", socketId, "fromWatcher", event.candidate)
    }

    //console.log("Sending an answer from watcher!");
    //Step 10. Set the remote description, officially create the answer, then set the local description, and send the description to the broadcaster
    newRemotePeerConnection
      .setRemoteDescription(description)
      .then(() => newRemotePeerConnection.createAnswer())
      .then(sdp => newRemotePeerConnection.setLocalDescription(sdp))
      .then(() => socket.emit("answer", socketId, newRemotePeerConnection.localDescription))
    //Now we should have an established connection!
  }

  //we run this when someone stops broadcasting. we want to close all the open connections we have with the broadcasters,
  //and the broadcasters will do the same on their end. any new requests will create new connections
  const closeWatcherConnection = (socketId) => {
    watcherConnections.current = watcherConnections.current.filter(connectionObj => {
      if (connectionObj.socketId !== socketId){
        return true
      } else {
        connectionObj.connection.close()
        //console.log("watcher connection is closed", connectionObj);
        return false
      }
    })
  }

  //we run this when someone stops broadcasting. we want to close all the open connections we have with our watcher,
  //and the watchers will do the same on their end. any new requests will create new connections
  const closeBroadcasterConnection = (socketId) => {
    broadcasterConnections.current = broadcasterConnections.current.filter(connectionObj => {
      if (connectionObj.socketId !== socketId){
        return true
      } else {
        //console.log("broadcaster connection is closed");
        connectionObj.connection.close()
        return false
      }
    })
  }

  return (
      <div style={{ textAlign: "center", width: "100vw", height: "100vh"}} className={"fl w-100 pa2"}>
        {user === null || !serverResponse ?
          <Signin/> :
          <ChatRoom broadcasterConnections={broadcasterConnections}/>
        }
      </div>
  );
}

export default App
