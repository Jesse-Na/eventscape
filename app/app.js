const express = require("express");
const { Pool } = require("pg");
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

const authMiddleware = (req, res, next) => {
	next();
};

// Apply authentication middleware to all routes
app.use(authMiddleware);

const pool = new Pool({
	host: process.env.POSTGRES_SERVICE_HOST || "db",
	port: process.env.POSTGRES_SERVICE_PORT || 5432,
	user: "postgres",
	password: "SecurePassword",
	database: "postgres",
});

app.get("/test", (req, res) => {
	pool.query("SELECT * FROM test;", (err, result) => {
		if (err) {
			console.error("Error executing query:", err);
			res.status(500).json({ error: "Database query failed" });
		} else {
			res.status(200).json(result.rows);
		}
	});
});

app.get("/insert", (req, res) => {
	pool.query(
		"INSERT INTO test (name, sold) VALUES ('Sample Name', 100) RETURNING *;",
		(err, result) => {
			if (err) {
				console.error("Error executing insert:", err);
				res.status(500).json({ error: "Database insert failed" });
			} else {
				res.status(200).json(result.rows[0]);
			}
		}
	);
});

// GET /status: Whether server is up or not
app.get("/status", (req, res) => {
	try {
		res.status(200).json({ status: "UP" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
