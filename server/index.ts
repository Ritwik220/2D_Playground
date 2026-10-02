import express, { Request, Response } from 'express';
import {Server} from "socket.io";
import {createServer} from "http";
import type {Socket} from "socket.io";


const port = process.env.PORT || 3000;
const server = express();
const voiceReadyPeers = new Set<string>();

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
    socket.broadcast.emit("player_joined", players.get(socket.id));
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

    socket.on("disconnect", () => {
        players.delete(socket.id);
        socket.broadcast.emit("player_left", socket.id);
        console.log("Player disconnected: ", socket.id);
    })
})



httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

