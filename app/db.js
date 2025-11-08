const { Pool } = require("pg");

const pool = new Pool({
	host: process.env.POSTGRES_SERVICE_HOST || "db",
	port: process.env.POSTGRES_SERVICE_PORT || 5432,
	user: "postgres",
	password: "SecurePassword",
	database: "postgres",
});

module.exports = pool;
