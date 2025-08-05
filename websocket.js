// WebRTC Client - Making an Offer
const socket = new WebSocket("ws://localhost:8080");
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

async function startCall() {
  // 1. Get user media (camera/microphone)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // 2. Add stream to peer connection
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  // 3. Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(
        JSON.stringify({
          type: "ice-candidate",
          candidate: event.candidate,
        })
      );
    }
  };

  // 4. Handle incoming remote stream
  pc.ontrack = (event) => {
    const remoteVideo = document.getElementById("remoteVideo");
    remoteVideo.srcObject = event.streams[0];
  };

  // 4. Create and send offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.send(
    JSON.stringify({
      type: "offer",
      offer: offer,
    })
  );
}

// Handle incoming messages
socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "answer") {
    await pc.setRemoteDescription(message.answer);
  }

  if (message.type === "ice-candidate") {
    await pc.addIceCandidate(message.candidate);
  }
};

// Start the call
startCall();
