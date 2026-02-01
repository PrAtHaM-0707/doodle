import { Server, Socket } from 'socket.io';
import { roomManager } from './controllers/roomController';
import { CreateRoomPayload, JoinRoomPayload, RoomSettingsPayload, DrawPayload } from './types';

export const setupSocket = (io: Server) => {
    // Setup callbacks
    roomManager.onTick = (roomId, time) => {
        io.to(roomId).emit('timer_update', time);
    };

    roomManager.onRoomUpdate = (roomId, room) => {
        io.to(roomId).emit('room_updated', room);
        
        const serverRoom = roomManager.getRoom(roomId);
        if (!serverRoom) return;

        // If phase is selecting, send words to drawer
        if (serverRoom.roundPhase === 'selecting' && serverRoom.wordsToChoose.length > 0 && serverRoom.currentDrawerId) {
             io.to(serverRoom.currentDrawerId).emit('choose_words', serverRoom.wordsToChoose);
        }

        // If phase switched to drawing, sent secret word
        if (serverRoom.roundPhase === 'drawing' && serverRoom.secretWord && serverRoom.currentDrawerId) {
             io.to(serverRoom.currentDrawerId).emit('your_turn', { word: serverRoom.secretWord });
        }
    };

    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('create_room', (payload: CreateRoomPayload, callback) => {
            const { username, avatar, drawTime, rounds } = payload;
            const room = roomManager.createRoom(username, avatar, socket.id, drawTime, rounds);
            socket.join(room.id);
            callback({ roomId: room.id, room });
            console.log(`Room created: ${room.id} by ${username}`);
        });

        socket.on('join_room', (payload: JoinRoomPayload, callback) => {
            const { roomId, username, avatar } = payload;
            const result = roomManager.joinRoom(roomId, username, avatar, socket.id);

            if ('error' in result) {
                callback({ error: result.error });
            } else {
                socket.join(roomId);
                // Notify everyone in the room
                io.to(roomId).emit('room_updated', result);
                callback({ success: true, room: result });
                console.log(`${username} joined room ${roomId}`);
            }
        });

        socket.on('leave_room', () => {
             const room = roomManager.getRoomBySocketId(socket.id);
             if (room) {
                 const updatedRoom = roomManager.leaveRoom(room.id, socket.id);
                 socket.leave(room.id);
                 if (updatedRoom) {
                     io.to(room.id).emit('room_updated', updatedRoom);
                 } else {
                     console.log(`Room ${room.id} deleted`);
                 }
             }
        });

        socket.on('update_settings', (payload: RoomSettingsPayload) => {
            // In real app, check if sender is host
            const room = roomManager.getRoom(payload.roomId);
            if (room) {
                 const updated = roomManager.updateSettings(payload.roomId, payload.settings);
                 if (updated) {
                     io.to(room.id).emit('room_updated', updated);
                 }
            }
        });

        socket.on('start_game', (roomId: string) => {
            const updated = roomManager.startGame(roomId);
            if (updated) {
                io.to(roomId).emit('room_updated', updated);
                io.to(roomId).emit('game_started');
                // Callbacks in roomManager (onRoomUpdate) will handle sending words/state
            }
        });

        socket.on('reset_to_lobby', (roomId: string) => {
             const updated = roomManager.resetToLobby(roomId);
             if (updated) {
                 io.to(roomId).emit('room_updated', updated);
                 io.to(roomId).emit('game_reset'); 
             }
        });

        socket.on('select_word', (payload: { roomId: string, word: string }) => {
            const room = roomManager.getRoom(payload.roomId);
             if (room && room.currentDrawerId === socket.id && room.roundPhase === 'selecting') {
                 roomManager.selectWord(payload.roomId, payload.word);
                 // onRoomUpdate callback will handle broadcast
             }
        });

        socket.on('draw', (payload: DrawPayload) => {
            // Broadcast drawing execution to others in room
            socket.to(payload.roomId).emit('draw', payload.data);
            // Optionally save to canvasHistory in roomManager
        });

        socket.on('chat', (payload: { roomId: string; message: string; user: string }) => {
            // Process guess if game is playing
            const result = roomManager.processGuess(payload.roomId, socket.id, payload.message);
            
            if (result.isCorrect) {
                io.to(payload.roomId).emit('chat', { 
                    user: payload.user, 
                    text: 'guessed the word!', 
                    type: 'system',
                    isCorrect: true 
                });
                // Send update for scores
                const room = roomManager.getRoomBySocketId(socket.id);
                if (room) io.to(payload.roomId).emit('room_updated', roomManager.getPublicRoom(room));
            } else {
                // If it's close, send a private system message to the sender
                if (result.isClose) {
                     io.to(socket.id).emit('chat', { 
                        user: 'System', 
                        text: `You are close! ('${payload.message}' is close)`, 
                        type: 'system' 
                    });
                }
                
                // Always broadcast the original message (as requested by user)
                io.to(payload.roomId).emit('chat', { user: payload.user, text: payload.message, type: 'chat' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            const room = roomManager.getRoomBySocketId(socket.id);
            if (room) {
                const updatedRoom = roomManager.leaveRoom(room.id, socket.id);
                if (updatedRoom) {
                     io.to(room.id).emit('room_updated', updatedRoom);
                } else {
                     console.log(`Room ${room.id} deleted`);
                }
            }
        });
    });
};
