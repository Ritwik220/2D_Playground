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

const PgStore = connectPgSimple(session);


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

//session
app.use(session({
  store: new PgStore({ pool: db, createTableIfMissing: true }),
  secret: process.env.SECRET_KEY!,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 },
}));





// setting up passport
app.use(passport.initialize());
app.use(passport.session());




const io = new Server(httpServer, {
    cors: {
        origin: true,
        credentials: true
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
app.post("/auth/login/", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).json({
                message: "Invalid username or password",
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

app.get("api/users/:username", async (req, res) => {
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