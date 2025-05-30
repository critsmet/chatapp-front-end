# ChatApp: The Front End

The front end of ChatApp is a simple video and text chat application built with [Create React App](https://github.com/facebook/create-react-app), [SocketIO](https://github.com/socketio/socket.io), and [WebRTC](https://github.com/webrtc). An infinite amount of chat users can join four user live streams and interact in real time. The live app is hosted by Render [here](https://chatapp-front-end.onrender.com) (please allow a few minutes for app to spin up).

## Installing & Running Locally

After forking and cloning the repo to your computer, ```cd``` into the directory using your terminal and run ```npm install```. If you haven't already forked, cloned, and launched the backend repository locally, visit [this link](https://github.com/critsmet/chatapp-back-end) to the back end application and set it up, or go to the ```src/redux/appReducer``` file in the application's directory and change the argument for the ```socketIOClient``` to ```https://chatapp-back-end.onrender.com``` so that the local application uses the server-hosted application. Run ```npm start``` in your terminal to get the app up and running.

## Future Development

This app is open to suggestions, contributions, and pull requests. Some ideas to take the app further:

### Responsive Design

Currently, the styling of the application is best suited for horizontal desktop and laptop screens. Users should be able to access the application's features on mobile devices and screens of differing proportions.

### More than 4 Users

Right now, a user broadcasting their video stream creates a "mesh network" by establishing a peer-to-peer connection with each other user also broadcasting a peer connection. Right now, the application only supports 4 users at a time – a decision made by the developer. More than 4 users should be able to use the application at the time.

### Direct/Private Messaging

When the app is launched in the browser and a user is logged in, scrolling down reveals the handles of other users also connected to the application via the socket. Clicking on a handle should prompt a direct message in the text input field that is only received by that specific user.