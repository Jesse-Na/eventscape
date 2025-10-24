const express = require("express");
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

const authMiddleware = (req, res, next) => {
	next();
};

// Apply authentication middleware to all routes
app.use(authMiddleware);

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
