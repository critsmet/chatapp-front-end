import { useRef, useEffect } from "react";
import type { Stream, User } from "../types";

const VideoStream = ({
  streamObj,
  user,
  isClient,
}: {
  streamObj: Stream;
  user: User;
  isClient: boolean;
}) => {
  const videoEl = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoEl.current;
    video!.srcObject = streamObj.stream;
  }, [videoEl, streamObj.stream]);

  return (
    <div
      id={`video-div-${streamObj.socketId}`}
      className="relative w-100 h-100 "
    >
      <div className="absolute top-1 tc w-100 white">{user.username}</div>
      <video
        className="h-75"
        id={`stream-${streamObj.socketId}`}
        ref={videoEl}
        autoPlay={true}
        muted={isClient ? true : false}
      />
    </div>
  );
};

export default VideoStream;
