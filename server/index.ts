import express, { Request, Response } from 'express';
import {Server} from "socket.io";
import {createServer} from "http";


const port = process.env.PORT || 3000;
const server = express();


