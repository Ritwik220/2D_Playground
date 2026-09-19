import express, {type Request, type Response, type Express} from 'express';
import { Server } from 'socket.io';
import { createServer } from "http";

const app:Express = express();
const httpServer = createServer(app);
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const io = new Server(httpServer, {
    cors:{
        origin: true
    }
})

const players = new Map();
const port = process.env.PORT || 3001;


io.on("connection", (socket) => {
    // setup
    console.log("PLayer connected", socket.id);

    players.set(socket.id, {
        id: socket.id,
        x:400,
        y:300,
        direction: "up",
        action: "idle"
    })

    socket.emit("players", Array.from(players.values()));

    // Player joined broadcast
    socket.broadcast.emit(
        "player_joined",
        players.get(socket.id)
    );

    // voiced player joined
    socket.broadcast.emit(
        "voiced_peer_joined",
        {
            id:socket.id,
        }
    )

    // movement
    socket.on("player_move", (data) => {
        const player = players.get(socket.id);

        if(!player) return;

        player.x = data.x;
        player.y = data.y;
        player.direction = data.direction;
        player.action = data.action;
        socket.broadcast.emit("player_moved", player);
    })

    socket.on("voice_offer", ({target, offer}) => {
        io.to(target).emit("voice_offer", {
            sender: target,
            offer: offer
        });
    })

    socket.on("voice_answer", ({target, answer}) => {
        io.to(target).emit("voice_answer", {
            sender: target,
            answer: answer
        });
    })

    socket.on("voice_ice_candidate", ({target, candidate}) => {
        io.to(target).emit("voice_ice_candidate", {sender: target, candidate: candidate});
    })
    // Disconnect
    socket.on("disconnect", (data) => {
        players.delete(socket.id);
        socket.broadcast.emit("player_left", socket.id);
        console.log("Player disconnected: ", socket.id);
    })

})
httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

