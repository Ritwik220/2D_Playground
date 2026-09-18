import express, {type Request, type Response, type Express} from 'express';
import { Server } from 'socket.io';
import { createServer } from "http";
import { Socket } from 'dgram';

const app:Express = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors:{
        origin: "http://localhost:5173"
    }
})

const players = new Map();
const port:number = 3000;

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

    socket.broadcast.emit(
        "player_joined",
        players.get(socket.id)
    );


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


    // Disconnect
    socket.on("disconnect", (data) => {
        players.delete(socket.id);
        socket.broadcast.emit("player_left", socket.id);
        console.log("Player disconnected: ", socket.id);
    })

})
httpServer.listen(3001, () => {
    console.log("Server running on http://localhost:3001");
});

