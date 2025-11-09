const { Pool } = require("pg");

const pool = new Pool({
	host: process.env.DB_HOST || "db",
	port: process.env.DB_PORT || 5432,
	user: process.env.DB_USER || "postgres",
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME || "postgres",
});

module.exports = pool;
