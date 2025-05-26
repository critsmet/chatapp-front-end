import { io } from "socket.io-client";

const socket = io(process.env.NODE_ENV === 'production' ? "https://chatapp-back-end.herokuapp.com" : "http://localhost:4001")

export default socket