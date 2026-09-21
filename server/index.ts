import express, { Request, Response } from 'express';
import {Server} from "socket.io";
import {createServer} from "http";
import type {Socket} from "socket.io";


const port = process.env.PORT || 3000;
const server = express();

const httpServer = createServer(server);
const io = server.listen(5173);


io.on('connection', (socket:Socket)=> {
    console.log("Connected to socket : ", socket.id);
})


httpServer.listen(port)

