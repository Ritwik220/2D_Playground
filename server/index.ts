import express, { type Request, type Response, type Express } from 'express';
import { Server } from 'socket.io';
import { createServer, METHODS } from "http";
import db from "./db.js";
import bcrypt from 'bcryptjs';
import "dotenv/config";
import cors from "cors";
import session from 'express-session';
import passport, { authenticate } from 'passport';
import { Strategy } from 'passport-local';
import connectPgSimple from "connect-pg-simple";
import {Redis} from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

const PgStore = connectPgSimple(session);


// Defining the number of hash cycles
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
db.connect();
// Tracking users
const userSockets = new Map<Number, string>();


const app: Express = express();
const httpServer = createServer(app);
const frontendUrl = process.env.VITE_FRONTEND_URL || "http://localhost:5173";
const loginUrl = frontendUrl + "/login";
const registerUrl = frontendUrl + "/register";

// for cors
app.use(cors({
  origin: [frontendUrl, registerUrl, loginUrl], 
  methods: ["GET", "POST", "PATCH"],
  credentials: true
}));





app.use(express.json());


app.set("trust proxy", 1);



const sessionMiddleware = session({
  store: new PgStore({ pool: db, createTableIfMissing: true }),
  secret: process.env.SECRET_KEY!,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.DEPLOY == "true", sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 },
});

//session
app.use(sessionMiddleware);



// setting up passport
app.use(passport.initialize());
app.use(passport.session());




const io = new Server(httpServer, {
    cors: {
        origin: true,
        credentials: true
    }
})


// Creating redis clients
if(!process.env.REDIS_URL)
    throw new Error("redis url not configured");

const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

pubClient.on("error", (err) => {
    console.error("Redis publisher error:", err);
});

subClient.on("error", (err) => {
    console.error("Redis subscriber error:", err);
});



// Setting up the cache for the web socket connections
io.engine.use(sessionMiddleware);
io.engine.use(passport.initialize());
io.engine.use(passport.session());

const players = new Map();
// Tracks which sockets have their mic ready and have announced voice_ready.
// A peer is only offered to (or offers to) others once both sides are ready,
// which avoids the race where an offer arrives before localStream exists.
const voiceReadyPeers = new Set<string>();
const port = process.env.PORT || 3000;


io.on("connection", async (socket) => {
    let player: any;
         // disconnect
    socket.on("disconnect", async () => {
        const player = players.get(socket.id);

        // Always clean up local and shared connection state
        players.delete(socket.id);
        voiceReadyPeers.delete(socket.id);

        socket.broadcast.to("global room").emit(
            "player_left",
            {user_id: player.user_id, socket_id: socket.id}
        );

        try {
            await Promise.all([
                pubClient.hdel("players:global", socket.id),
                pubClient.srem("voiceReadyPeers:global", socket.id)
            ]);
        } catch (err) {
            console.error("Failed to clean up disconnected player:", err);
        }

        if (!player) return;

        // Only the latest connection for this user may update their save spot
        if (userSockets.get(user.id) === socket.id) {
            userSockets.delete(user.id);

            try {
                await db.query(
                    `UPDATE users
                    SET save_spot = $1
                    WHERE id = $2`,
                    [{ x: player.x, y: player.y }, user.id]
                );
                console.log("Saved the player position in the database")
            } catch (err) {
                console.error("Failed to save player position:", err);
            }
        }

        

        console.log("Player disconnected:", player.user_id);
    });

    // setup
    console.log("Player connected", socket.id);
    // socket.join("global room");

    /*
    CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    password_hash TEXT NOT NULL,
    save_spot JSONB DEFAULT '{"x": 400, "y": 300}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );
    */
    // getting the user object
    const req = socket.request as any;
    var user = req?.user;

        // Voice readiness handshake.
    // When a client's mic is ready, it tells us; we hand it the list of
    // peers who are already ready (guaranteed to have their own localStream
    // set), and the new client creates offers to those peers. We do NOT
    // proactively tell existing peers about the new one, because that's
    // exactly the race that used to break voice chat.
    socket.on("voice_ready", async () => {
        console.log("voice ready fired");
        await pubClient.sadd("voiceReadyPeers:global", socket.id);
        console.log("Added peer to redis");
        const sharedVoiceReadyPeers = await pubClient.smembers("voiceReadyPeers:global");
        socket.emit("voice_ready_peers", Array.from(sharedVoiceReadyPeers));
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
    /*
    CREATE TABLE global_chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT unique NOT NULL REFERENCES user(user_name),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );
    */

    // getting message
    socket.on(
        "chat message sent",
        async ({ message, username }: { message: string; username: string }) => {
            try {
                if (
                    typeof message !== "string" ||
                    !message.trim() ||
                    message.length > 500 ||
                    typeof username !== "string"
                ) {
                    return;
                }

                const sender_req = await db.query(
                    `SELECT id
                    FROM users
                    WHERE user_name = $1`,
                    [username]
                );

                if (sender_req.rows.length === 0) {
                    console.log("No user found:", username);
                    return;
                }

                const senderId = sender_req.rows[0].id;

                const insert = await db.query(
                    `INSERT INTO global_chat_messages
                        (username, sender_id, message)
                    VALUES ($1, $2, $3)
                    RETURNING id, created_at`,
                    [username, senderId, message.trim()]
                );

                if (insert.rows.length === 0) {
                    console.log("Global chat message insertion failed");
                    return;
                }

                io.emit("chat recieved", {
                    message: message.trim(),
                    username,
                    created_at: insert.rows[0].created_at,
                    id: insert.rows[0].id
                });
            } catch (err) {
                console.error("Global chat message insertion failed:", err);
            }
        }
    );
    // sending the username to the chat ui
    socket.on("send username", () => {
        socket.emit("chat ready", user.user_name);
    })


   
    // if(!user) {
    //     try{
    //         console.log("User not found on cache getting him/her from the database");
    //         //getting save spot from the database
    //         const response = await db.query(
    //             `SELECT *
    //             FROM users
    //             WHERE user_name = $1`,
    //             [user.user_name]
    //             );
    //         user = response.rows[0];
    //         req.user = user;
    //     }
    //     catch(err) {
    //         console.error("User not found: ", err);
    //     }
        
    // }
    console.log(user.display_name+ " joined");

    // const db_user = response.rows[0]
    const oldUser = userSockets.get(user.id);

    userSockets.set(user.id, socket.id);

    if (oldUser && oldUser !== socket.id) {
        io.sockets.sockets.get(oldUser)?.disconnect(true);
    }

    console.log(user.display_name+ " joined");

    // defining the player state
    player = {
        id: socket.id,
        x: user.save_spot.x,
        y: user.save_spot.y,
        direction: "up",
        action: "idle",
        username: user.user_name,
        user_id: user.id,
        display_name: user.display_name
    };
    if(await pubClient.hexists("players:global", socket.id)) {
        var cached_user = await pubClient.hget("players:global", socket.id);
        const stored_user: any = JSON.parse(cached_user!);
        player.x = Number(stored_user.x);
        player.y = Number(stored_user.y);
    }

    
    // Adding the player in the local map(for quick access during movement) and redis shared player map(for sprite creation across instances)
    players.set(socket.id, player);
    await pubClient.hset("players:global", socket.id, JSON.stringify(player));
    socket.join("global room");

    console.log({
        socketId: socket.id,
        joinedGlobalRoom: socket.rooms.has("global room"),
        rooms: [...socket.rooms]
    });



    // sending the spawn position so that the sprite in the frontend can be created accordingly
    socket.emit("spawn player", user.save_spot, user);
    

    // getting all the players from the common redis store
    const sharedPlayers = await pubClient.hgetall("players:global");
    const playerList = Object.values(sharedPlayers).map( player => JSON.parse(player));
    socket.emit("players", {players: Array.from(playerList.values()), user: user});

    // Player joined broadcast
    socket.broadcast.to("global room").emit(
        "player_joined",
        {player: players.get(socket.id)}
    );

    // movement
    socket.on("player_move", async (data) => {
        const player = players.get(socket.id);

        if (!player) return;

        player.x = data.x;
        player.y = data.y;
        player.direction = data.direction;
        player.action = data.action;
        // Storing the player in redis to update the position so that new players can get accurate posiotion even if they join later
        await pubClient.hset("players:global", socket.id, JSON.stringify(player));
        // Updationg the local cache and saving it
        req.user.save_spot = {
            x: data.x,
            y: data.y
        };

        req.session.save((err: any) => {
            if (err) {
                console.error("Failed to save session:", err);
            }
        });
        

        socket.broadcast.to("global room").emit("player_moved", player);
    })


    socket.on("connect_error", (err) => {
        console.error("socket connection error: ", err)
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
app.post("/auth/login/", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.json({
                message: "Invalid password",
                code: 0
            });
        }
        console.log(user + "logged in");
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }

            return res.status(201).json({
                message: "Login successful",
                code: 1,
                user: user
            });
        });
    })(req, res, next);
});


app.post("/auth/register/", async (req, res, next) => {
    const data = req.body;
    const username = data.username;
    const password = data.password;
    const displayName = data.display_name;
    var ifRegistered = false;
    try {
        const checkRegistered = await db.query(`SELECT * 
            FROM users 
            WHERE user_name=$1`,
        [username]);
        if(checkRegistered.rows.length != 0)
            ifRegistered = true;
        else
            ifRegistered = false;
    } catch(err) {
        ifRegistered = false;
    }
    if(ifRegistered) {
        console.log(`User with username ${username} already exists!`);
        res.json({
            message: `User with username ${username} already exists`,
            code: 0
        })
    }
    else {
        // Lets do something definitely not safe for shits and giggles lol
        console.log(username, password, displayName);
        const hashedpassword = await hashPassword(password);
        try{
            const response = await db.query(
                `INSERT INTO users (user_name, password_hash, display_name)
                VALUES ($1, $2, $3)
                RETURNING id, user_name, display_name, save_spot`,
                [username, hashedpassword, displayName]
            );
            const user = response.rows[0];
            req.logIn(user, (err) => { 
                if (err) 
                    return next(err); 
                req.session.save((err) => { 
                    if (err) 
                        return next(err); 
                    console.log(user + " logged in");
                    return res.status(201).json({
                         message: "User registered", 
                         code: 1, 
                         user 
                        }
                    ); 
                }); 
            });
        }
        catch(err) {
            console.error(`Error in registering new user: ${err}`);
            res.json({
                message: err,
                code: 0
            })
        }

    }
    
})


// api calls

// authentication check call
app.get("/auth/me", (req, res) => {
    console.log("The stored user is "+req.user);
    if(req.user) {
        res.json({
            authenticated: true,
            user: req.user,
        })
    }
    else
        res.status(401).json({
            authenticated: false
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

app.get("/api/users/:username", async (req, res) => {
     const username = Number(req.params.username);

    try {
        const result = await db.query(
            `SELECT id, user_name, display_name, save_spot
             FROM users
             WHERE user_name = $1`,
            [username]
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

/*
CREATE TABLE global_chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    username TEXT unique NOT NULL REFERENCES user(user_name),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
 */
/* ------------------------------------------GET REQUESTS---------------------------------------------------*/
// getting the first 10 position from the position pos
app.get("/api/global/messages/:pos", async (req, res) => {
    const pos = Number(req.params.pos);

    if (!Number.isInteger(pos) || pos < 0) {
        return res.status(400).json({ error: "Invalid position" });
    }

    try {
        const result = await db.query(
            `SELECT id, username, message, created_at
             FROM global_chat_messages
             ORDER BY created_at DESC, id DESC
             LIMIT 10 OFFSET $1`,
            [pos]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Database error" });
    }
});
/* --------------------------------------- POST REQUESTS ---------------------------------------------------*/
app.post(
    "/api/global/messages/:senderId/:username",
    async (req, res) => {
        const senderId = Number(req.params.senderId);
        const username = req.params.username;
        const { message } = req.body;

        if (
            !Number.isInteger(senderId) ||
            senderId <= 0 ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                error: "Invalid sender ID or message"
            });
        }

        try {
            const result = await db.query(
                `INSERT INTO global_chat_messages
                    (sender_id, username, message)
                 VALUES ($1, $2, $3)
                 RETURNING id, sender_id, username, message, created_at`,
                [senderId, username, message.trim()]
            );

            return res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                error: "Database error"
            });
        }
    }
);

// Authentication strategy
passport.use(new Strategy(async function verify(username, password, cb) {
    var foundUser = false;
    var correctPassword = false;
    var user: any;
    try {
         const isRegistered = await db.query(`SELECT * 
            FROM users 
            WHERE user_name=$1`,
        [username]);
         
         if(isRegistered.rows.length != 0) {
            foundUser = true;
            user = isRegistered.rows[0];
            correctPassword = await bcrypt.compare(password, user.password_hash)
         }
        else 
            foundUser = false;
        
    }
    catch(err) {
        console.log("Unable to find user: ", err);
        return cb(err);
    }
    if(correctPassword && foundUser) {
        console.log("User found and authenticated");
        return cb(null, user)
    }
    else if(foundUser) {
        console.log("user found");
        return cb(null, false);
    }
    else {
        return cb("User not found");
    }

    // doing somthing wrong :)
    console.log(username, password);
}))


// Serialization and deserialization of the user object
passport.serializeUser((user, cb) => {
    cb(null, user);
})
passport.deserializeUser((user:any, cb) => {
    cb(null, user);
})


httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});