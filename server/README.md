# Scribbl - Backend Server

This is the backend server for the Scribbl clone, built with Node.js, Express, Socket.io, and TypeScript.

## Setup

1.  Navigate to this directory:
    ```bash
    cd server
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

The server will start on port **3001**.

## Architecture

-   **src/server.ts**: Entry point, sets up Express and Socket.io.
-   **src/socket.ts**: Handles all real-time events (`create_room`, `join_room`, `draw`, etc.).
-   **src/controllers/roomController.ts**: Manages the in-memory state of rooms and players (`RoomManager` class).
-   **src/types/**: Shared TypeScript interfaces.

## API / Events

-   `create_room`: { username, avatar } -> returns { roomId, room }
-   `join_room`: { roomId, username, avatar } -> returns { success, room } | { error }
-   `leave_room`: () -> returns nothing
-   `update_settings`: { roomId, settings } -> broadcast `room_updated`
-   `start_game`: { roomId } -> broadcast `room_updated`
-   `draw`: { roomId, data } -> broadcast `draw`

## Notes

-   Database is currently **In-Memory**. Restarting the server wipes all rooms.
