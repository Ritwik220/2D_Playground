import {Pool} from "pg";


const db = new Pool({
    host:process.env.DB_HOST || "localhost",
    port:Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.on("error", (err) => {
    console.error("Unexpected database error:", err);

})
export default db;

