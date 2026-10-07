import express, { type Request, type Response, type Express } from 'express';
import { Server } from 'socket.io';
import { createServer } from "http";
import db from "./db.js";
import bcrypt from 'bcryptjs';
import "dotenv/config";

const hash = 10;

async function testDB() {
    try {
        const result = await db.query("SELECT NOW()");
        console.log("Database connected:", result.rows[0]);
    } catch (err) {
        console.error("Database connection failed:", err);
    }
}

async function hashPassword(password: string) :Promise<string> {
    return await bcrypt.hash(password, hash);
}


testDB();

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
const port = process.env.PORT || 3000;


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
/*
metaverse=# CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    password_hash TEXT NOT NULL,
    save_spot JSONB DEFAULT '{"x": 400, "y": 300}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

// Login and authentication
app.get("/auth/login/", (req, res) => {
    const data = req.body;
    const username = data.username;
    const password = data.password;

    // doing somthing wrong :)
    console.log(username, password);
})

app.get("/auth/register/", async (req, res) => {
    const data = req.body;
    const username = data.username;
    const password = data.password;
    const displayName = data.displayName;
    // Lets do something definitely not safe for shits and giggles lol
    console.log(username, password, displayName);
    const hashedpassword = await hashPassword(password);
    db.query(`INSERT INTO users (user_name, password, display_name) VALUES (${username}, ${hashedpassword}, ${displayName})`);

})


// api calls
/*
metaverse=# CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    password_hash TEXT NOT NULL,
    save_spot JSONB DEFAULT '{"x": 400, "y": 300}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

/* ------------------------------------------GET REQUESTS---------------------------------------------------*/
// all users
app.get("/api/users/", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, user_name, display_name, save_spot
             FROM users`
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "No users found"
            });
        }

        res.json(result.rows);
    }
    catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Database error"
        });
    }
});

// specific user
app.get("/api/users/:id", async (req, res) => {
    const userId = Number(req.params.id);

    try {
        const result = await db.query(
            `SELECT id, user_name, display_name, save_spot
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Database error"
        });
    }
});
/* --------------------------------------- POST REQUESTS ---------------------------------------------------*/
app.post('/api/users/', async (req, res) => {
    const { userName, displayName, password } = req.body;

    try {
        const result = await db.query(`INSERT INTO users
        (user_name, display_name, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, user_name, display_name, save_spot`,
            [userName, displayName, password]);
        res.status(201).json(result.rows[0]);
    }
    catch(error) {
        console.error(error);

        res.status(500).json({
            erro: "Database error"
        });
    }
})
/* --------------------------------------- PATCH REQUESTS ---------------------------------------------------*/
app.patch('/api/users/:id/position', async (req, res) => {
    const userId = req.params.id;
    const { x, y } = req.body;
    try {
        const result = await db.query(
            `UPDATE users
             SET save_spot = $1
             WHERE id = $2
             RETURNING id, save_spot`,
            [{ x, y }, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.json(result.rows[0]);
    } catch(error) {
        console.error(error);

        res.status(500).json({
            erro: "Database error"
        });
    }
})
/*
CREATE TABLE
metaverse=# CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

// chat messages of 2 users
/* ------------------------------------------GET REQUESTS---------------------------------------------------*/
app.get('/api/chats/:senderId/:receiverId', async (req, res) => {
    const senderId = Number(req.params.senderId);
    const receiverId = Number(req.params.receiverId);

    try {
        const result = await db.query(
            `SELECT id, sender_id, receiver_id, message, created_at
             FROM chat_messages
             WHERE (sender_id = $1 AND receiver_id = $2)
                OR (sender_id = $2 AND receiver_id = $1)
             ORDER BY created_at ASC`,
            [senderId, receiverId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "No messages found"
            });
        }

        res.json(result.rows);
    }
    catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Database error"
        });
    }
});
/* --------------------------------------- POST REQUESTS ---------------------------------------------------*/
app.post('/api/chats/:senderId/:receiverId', async (req, res) => {
    const senderId = Number(req.params.senderId);
    const receiverId = Number(req.params.receiverId);
    const { message } = req.body;
    try {
        const result = await db.query(`INSERT INTO chat_messages
                      (sender_id, receiver_id, message)
                      VALUES ($1, $2, $3) RETURNING id, sender_id, receiver_id, message, created_at`,
                      [senderId, receiverId, message]);
        res.status(201).json(result.rows[0]);
    }
    catch(error) {
        console.error(error);

        res.status(500).json({
            error: "Database error"
        });
    }
})



httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});