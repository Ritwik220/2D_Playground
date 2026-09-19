import express, { type Request, type Response, type Express } from 'express';
import { Server } from 'socket.io';
import { createServer } from "http";

const app: Express = express();
const httpServer = createServer(app);
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const io = new Server(httpServer, {
    cors: {
        origin: true
    }
})

const players = new Map();
// Tracks which sockets have their mic ready and have announced voice_ready.
// A peer is only offered to (or offers to) others once both sides are ready,
// which avoids the race where an offer arrives before localStream exists.
const voiceReadyPeers = new Set<string>();
const port = process.env.PORT || 3001;


io.on("connection", (socket) => {
    // setup
    console.log("Player connected", socket.id);

    players.set(socket.id, {
        id: socket.id,
        x: 400,
        y: 300,
        direction: "up",
        action: "idle"
    })

    socket.emit("players", Array.from(players.values()));

    // Player joined broadcast
    socket.broadcast.emit(
        "player_joined",
        players.get(socket.id)
    );

    // movement
    socket.on("player_move", (data) => {
        const player = players.get(socket.id);

        if (!player) return;

        player.x = data.x;
        player.y = data.y;
        player.direction = data.direction;
        player.action = data.action;
        socket.broadcast.emit("player_moved", player);
    })

    // Voice readiness handshake.
    // When a client's mic is ready, it tells us; we hand it the list of
    // peers who are already ready (guaranteed to have their own localStream
    // set), and the new client creates offers to those peers. We do NOT
    // proactively tell existing peers about the new one, because that's
    // exactly the race that used to break voice chat.
    socket.on("voice_ready", () => {
        socket.emit("voice_ready_peers", Array.from(voiceReadyPeers));
        voiceReadyPeers.add(socket.id);
    });

    socket.on("voice_offer", ({ target, offer }) => {
        io.to(target).emit("voice_offer", {
            sender: socket.id,
            offer
        });
    });

    socket.on("voice_answer", ({ target, answer }) => {
        io.to(target).emit("voice_answer", {
            sender: socket.id,
            answer
        });
    });

    socket.on("voice_ice_candidate", ({ target, candidate }) => {
        io.to(target).emit("voice_ice_candidate", {
            sender: socket.id,
            candidate
        });
    });

    // Disconnect
    socket.on("disconnect", () => {
        players.delete(socket.id);
        voiceReadyPeers.delete(socket.id);
        socket.broadcast.emit("player_left", socket.id);
        console.log("Player disconnected: ", socket.id);
    })

})
httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});