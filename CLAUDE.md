# Project: Orbital Void (Online Multiplayer)

## 1. Project Overview
**Orbital Void** is a real-time, online multiplayer space shooter running in a web browser. Two players connect from separate devices via the internet to a central server. They control rockets in a constrained circular arena using Newtonian physics (inertia, momentum, drift). The goal is to destroy the opponent by shooting them or forcing them into the arena walls.

## 2. Technical Stack
* **Runtime:** Node.js
* **Backend Framework:** Express (for serving static files)
* **Real-time Communication:** Socket.io (WebSocket wrapper)
* **Frontend Rendering:** HTML5 Canvas API (Vanilla JS)
* **Physics Engine:** Custom Vector-based implementation (Running on Server)

## 3. Architecture: Authoritative Server
To prevent cheating and ensure synchronization across the internet, the game uses an **Authoritative Server** model.

1.  **Client:** Captures inputs (WASD/Space) and sends them to the Server.
2.  **Server:** Calculates physics, collisions, health, and positions.
3.  **Server:** Broadcasts the "World State" to both clients (tick rate: 60Hz).
4.  **Client:** Renders the World State received from the Server.

## 4. File Structure
```text
/
├── package.json          # Dependencies: express, socket.io
├── server.js             # Entry point: Http server, Socket setup, Game Loop
├── public/               # Client-side code
│   ├── index.html        # Login UI & Game Canvas
│   ├── style.css         # UI Overlay styling
│   └── client.js         # Socket client, Renderer, Input Listener
└── lib/                  # Shared logic (optional, or kept in server.js for simplicity)
    ├── Vector.js         # Math helper
    └── GameState.js      # Physics engine & Room management