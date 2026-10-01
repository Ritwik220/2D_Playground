import express, { Request, Response } from 'express';
import {Server} from "socket.io";
import {createServer} from "http";
import type {Socket} from "socket.io";


const port = process.env.PORT || 3000;
const server = express();

const httpServer = createServer(server);
const io = new Server(httpServer, {
    cors: {
        origin: true
    }
})

// Used to map all the players
const players = new Map();


io.on('connection', (socket:Socket)=> {
    console.log("Connected to socket : ", socket.id);
    // Adding the player in the scene, the initial position is kept as 300, 400 as of now
    players.set(socket.id, {
        id: socket.id,
        x: 300,
        y: 400,
        action: "idle",
        direction: "up"
    });

    // Sending the players
    socket.emit("players", Array.from(players.values()));
    // Sending the message that informs everyone that a new player has joined
    socket.broadcast.emit('players_joined', players.get(socket.id));
    /* Recieves a message from the frontend that informs us that the player has moved 
    It changes the data of that player to match its location, direction, etc
    Returns a player_moved messaqge that informs everyone that this player have moved */
    socket.on("player_move", (data) => {
        const player = players.get(socket.id);

        if(!player) return;
        player.x = data.x;
        player.y= data.y;
        player.direction = data.direction;
        player.action = data.action;
        socket.emit("player_moved", player);
    })

    socket.on("disconnect", () => {
        players.delete(socket.id);
        socket.broadcast.emit("player_left", socket.id);
        console.log("Player disconnected: ", socket.id);
    })
})



httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

