import { useState, Fragment, type FormEvent } from "react";

import socket from "../socket";
import type { User } from "../types";

const Signin = ({
  users,
  isConnected,
}: {
  users: User[];
  isConnected: boolean;
}) => {
  const [username, changeUsername] = useState("");
  const [message, setMessage] = useState("");

  const signupUser = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username === "") {
      setMessage("please enter a handle");
    } else if (users.find((user: User) => user.username === username)) {
      setMessage("username taken");
    } else {
      socket.emit("initializeSession", username);
    }
  };

  const formatInput = (value: string) => {
    setMessage("");
    if (value.length >= 13) {
      setMessage("max 12 characters");
    } else if (value.match(/\W/)) {
      setMessage("invalid character");
    } else if (value === "") {
      changeUsername(value);
    } else {
      changeUsername("@" + value);
    }
  };

  const formHTML = (
    <Fragment>
      <p className="h1 pt1">{message}</p>
      <form
        id="signin-form"
        className="flex flex-column items-center"
        onSubmit={signupUser}
      >
        <input
          placeholder="enter a handle"
          onChange={(e) =>
            formatInput(
              e.target.value[0] === "@"
                ? e.target.value.slice(1)
                : e.target.value
            )
          }
          type="text"
          className="db w-75 mb3 h3 bg-washed-yellow fw2 grow tc f2"
          spellCheck="false"
          value={username}
        />
        <input
          type="submit"
          value="join"
          className="db w-25 h2 p3 br-pill white bg-dark-gray bg-animate hover-bg-mid-gray pointer tc f4"
        />
      </form>
    </Fragment>
  );

  return (
    <div id="signin" className="w-40">
      {isConnected ? (
        formHTML
      ) : (
        <p className="h1 pt1">Connecting to the server...</p>
      )}
    </div>
  );
};

export default Signin;
