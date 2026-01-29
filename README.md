# Orkun Lounge 

Orkun Lounge is a real-time desktop communication application built on the Electron framework. It provides integrated text messaging and high-fidelity voice channels using WebRTC technology.

## Overview

The application serves as a centralized social hub where users can communicate via global chat rooms and dedicated voice lounges. By utilizing Socket.io for messaging and PeerJS for voice streaming, it offers a low-latency experience suitable for both casual hangouts and collaborative work.

## Installation
Lounge Chat is distributed as a standalone desktop application. To install the application on any platform, follow these steps:

1.Download the latest executable from the Releases section.

2.Run the installer to add Lounge Chat to your system.

3.Launch the application from your desktop or applications folder.

If you are developing or building from source, ensure you have Node.js installed and run:

```bash
npm install
npm run build
```
Note: The integrated PeerServer runs on the same port as the Express backend, simplifying deployment and firewall configuration.

## Features

Lounge Chat includes several integrated systems for a comprehensive communication experience:

- Real-Time Messaging: Instant text communication across all connected clients.

- Voice Connectivity: Reliable peer-to-peer voice connectivity with a a self-hosted signaling server.

- User Presence: Dynamic online status indicators that show active users and their current voice state.

- Secure Authentication: User data protection through industry-standard encryption and session management.

## Usage

Once the application is launched, users can follow this workflow to start communicating:

- Authentication: Sign up for a new account or log in with existing credentials.

- Global Chat: Enter messages in the input area at the bottom of the interface and press Send to communicate with all online users.

- Voice Channel: Click the Join Voice button in the sidebar to enter the active voice lounge.

- Voice Controls: Use the microphone icon to mute your audio or the headset icon to deafen incoming sounds. Use the exit icon to leave the voice channel.

## Technical Stack

- The project is built using the following technologies:

- Framework: Electron.js

- Backend: Node.js and Express.js

- Communication: Socket.io (Websockets)

- Voice Protocol: PeerJS (WebRTC) with a Self-Hosted PeerServer

- Database: MySQL

- Security: Bcrypt for password hashing

## License

This project is licensed under the MIT License - see the [LICENSE](https://choosealicense.com/licenses/mit/) file for details.
