# Orkun Lounge

A real-time desktop communication application built with Electron, featuring integrated text messaging, voice channels, and screen sharing using WebRTC technology.

![Electron](https://img.shields.io/badge/Electron-40.0-47848F)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Overview

Orkun Lounge serves as a centralized social hub where users can communicate via global chat rooms and dedicated voice lounges. By utilizing Socket.io for real-time messaging and PeerJS for WebRTC voice/video streaming, it offers a low-latency experience suitable for both casual hangouts and collaborative work.

## Features

### Communication
- **Real-Time Messaging** - Instant text communication with all connected users
- **Voice Channels** - High-quality peer-to-peer voice connectivity
- **Screen Sharing** - Share your screen with other users in voice channels
- **Typing Indicators** - See when other users are typing
- **Message Reactions** - React to messages with emojis
- **Message Deletion** - Delete your own messages

### User Experience
- **User Presence** - Dynamic online status indicators (Online, Idle, DND, Invisible)
- **Voice Activity** - Visual indicators for who is speaking
- **User List** - See all online users and their current status
- **Modern Dark UI** - Clean, Discord-inspired interface

### Security
- **Secure Authentication** - Password hashing with bcrypt
- **Session Management** - Secure session handling with HTTP-only cookies
- **Rate Limiting** - Protection against brute force attacks
- **Helmet.js** - Security headers and CSP protection
- **Input Validation** - Server-side validation with validator.js

### Admin Features
- **Clear Chat** - Admin can clear all chat messages
- **Kick Users** - Admin can remove users from the server

## Installation

### Download (Recommended)

1. Download the latest executable from the [Releases](https://github.com/orkxn/Orkun-Lounge/releases) section
2. Run the installer to add Orkun Lounge to your system
3. Launch the application from your desktop or applications folder

### Build from Source

**Prerequisites:**
- Node.js (v18 or higher)
- MySQL database
- Git

**Steps:**

1. Clone the repository
   ```bash
   git clone https://github.com/orkxn/Orkun-Lounge.git
   cd Orkun-Lounge
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   
   Create a `.env` file with:
   ```env
   DB_HOST=your_database_host
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   DB_NAME=your_database_name
   DB_PORT=3306
   SESSION_SECRET=your_session_secret
   ```

4. Set up the database
   
   Create the required MySQL tables for users and messages.

5. Start the server
   ```bash
   npm start
   ```

6. Run Electron app (development)
   ```bash
   npm run electron
   ```

7. Build for distribution
   ```bash
   npm run dist
   ```

## Usage

### Authentication
- Sign up for a new account or log in with existing credentials
- Passwords are securely hashed using bcrypt

### Global Chat
- Enter messages in the input area at the bottom of the interface
- Press Send or Enter to communicate with all online users
- React to messages by clicking the reaction button
- Delete your own messages using the delete option

### Voice Channel
- Click the **Join Voice** button in the sidebar to enter the active voice lounge
- Use the microphone icon to mute/unmute your audio
- Use the headset icon to deafen/undeafen incoming sounds
- Use the exit icon to leave the voice channel

### Screen Sharing
- While in a voice channel, click the screen share button
- Select the window or screen you want to share
- Other voice channel members can view your screen
- Click stop sharing to end the screen share

### Status
- Click your status indicator to change between:
  - Online (Green)
  - Idle (Yellow)
  - Do Not Disturb (Red)
  - Invisible (Gray)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron.js |
| Backend | Node.js, Express.js |
| Real-time | Socket.io (WebSockets) |
| Voice/Video | PeerJS (WebRTC) with Self-Hosted PeerServer |
| Database | MySQL |
| Security | bcrypt, Helmet.js, express-rate-limit |
| Session | express-session |
| Validation | validator.js |

## Project Structure

```
Orkun-Lounge/
├── public/
│   ├── favicon.ico
│   └── ...
├── dist/                  # Built executables
├── chat.html              # Main chat interface
├── dashboard.html         # User dashboard
├── server.js              # Express server with Socket.io
├── main.js                # Electron main process
├── package.json
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/signup` | POST | Create new user account |
| `/login` | POST | Authenticate user |
| `/logout` | POST | End user session |
| `/chat` | GET | Access chat interface (requires auth) |
| `/dashboard` | GET | Access user dashboard |

## Socket Events

### Client to Server
| Event | Description |
|-------|-------------|
| `user_joined` | User connects to chat |
| `chat_message` | Send a message |
| `typing_start` | User started typing |
| `typing_stop` | User stopped typing |
| `join-voice` | Join voice channel |
| `leave-voice` | Leave voice channel |
| `start-screenshare` | Start screen sharing |
| `stop-screenshare` | Stop screen sharing |
| `toggle_reaction` | Add/remove message reaction |
| `delete_message` | Delete own message |

### Server to Client
| Event | Description |
|-------|-------------|
| `new_message` | New chat message |
| `user_typing` | User typing status |
| `user_status_update` | User status change |
| `user-voice-status` | Voice channel join/leave |
| `user-started-screenshare` | Screen share started |
| `user-stopped-screenshare` | Screen share ended |
| `reaction_toggled` | Message reaction update |
| `message_deleted` | Message was deleted |

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL database host |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |
| `DB_PORT` | Database port (default: 3306) |
| `SESSION_SECRET` | Secret for session encryption |
| `PORT` | Server port (default: 3000) |

### PeerServer Configuration

The integrated PeerServer runs on the same port as the Express backend, simplifying deployment and firewall configuration.

## Security Considerations

- All passwords are hashed using bcrypt with appropriate salt rounds
- Sessions use HTTP-only cookies to prevent XSS attacks
- CSRF protection via SameSite cookie attribute
- Rate limiting on authentication endpoints (10 attempts per 15 minutes)
- Content Security Policy (CSP) headers via Helmet.js
- Input validation on all user inputs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/NewFeature`)
3. Commit your changes (`git commit -m 'Add NewFeature'`)
4. Push to the branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](https://choosealicense.com/licenses/mit/) file for details.

## Author

**Orkun**

---

Built with Electron, Express, and WebRTC
