import {Pool} from "pg";
import "dotenv/config";


const db = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              max: 5
          }
        : {
              host: process.env.DB_HOST || "localhost",
              port: Number(process.env.DB_PORT || 5432),
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME
          }
);

db.on("error", (err) => {
    console.error("Unexpected database pool error:", err);
});

export default db;
