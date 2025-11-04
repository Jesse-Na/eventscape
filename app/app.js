// app.js
const express = require("express");
const pool = require("./db");
const localStrategy = require("./auth.js");
const passport = require("passport");
const bcrypt = require("bcrypt");
const path = require("path");
const ejs = require("ejs");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const app = express();

app.use(
	session({
		secret: "GFGLogin346",
		resave: false,
		saveUninitialized: false,
	})
);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "views")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("html", ejs.renderFile);

passport.serializeUser((user, done) =>
	done(null, {
		id: user.user_id,
		email: user.email,
	})
);
passport.deserializeUser(async ({ id }, done) => {
	// Fetch user from db
	try {
		const { rows } = await pool.query(
			`select user_id, email from users where user_id = $1`,
			[id]
		);

		return done(null, rows[0]);
	} catch (error) {
		console.error("Error in deserializeUser:", error);
		return done(error);
	}
});

// --- Auth stub (double check) ---
const authMiddleware = (_req, _res, next) => next();
app.use(authMiddleware);

// --- Helpers ---
const VISIBILITY = new Set(["public", "private", "unlisted"]);
const RSVP_STATUS = new Set(["going", "waitlisted", "interested", "cancelled"]);
const isUUID = (s) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		s
	);

app.get("/", (req, res) => {
	if (req.session.userId) {
		const email = req.session.email;
		res.render("main", { email: email });
	}
	return res.render("main", { email: null });
});

app.get("/main", (req, res) => {
	res.redirect("/");
});

app.get("/login", (req, res) => {
	if (req.session.userId) {
		res.redirect("/");
	}
	res.render("login", { error: null });
});

app.post(
	"/login",
	passport.authenticate("local", { session: false }),
	(req, res) => {
		// Passport returns user object in body
		req.session.userId = req.body.user_id;
		req.session.email = req.body.email;
		req.session.save();

		return res.redirect("/");
	}
);

app.get("/register", (req, res) => {
	if (req.session.userId) {
		res.redirect("/");
	}
	res.render("register", { error: null });
});

app.post("/register", async (req, res) => {
	console.log(req.body);
	const { email, password } = req.body;
	if (!email && !password) {
		return res.status(400).render("register", { error: "Missing fields" });
	}
	try {
		// Check if user already exists
		const { rows } = await pool.query(
			`select * from users where email = $1`,
			[email]
		);

		if (rows.length > 0) {
			return res.status(409).render("register", {
				error: "User with that email already exists",
			});
		}

		// Hash the password before saving it to the database
		const salt = await bcrypt.genSalt(15);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Create and save the new user
		const insertResult = await pool.query(
			`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING user_id`,
			[email, hashedPassword]
		);

		// req.session.userId = insertResult.rows[0].user_id;
		// req.session.email = email;
		// req.session.save();

		return res.redirect("/login");
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
});

app.get("/post-register", (_req, res) => {
	res.render("post-register");
});

// --- Health/DB utilities ---
app.get("/status", (_req, res) => res.status(200).json({ status: "UP" }));

app.get("/db/ping", async (_req, res) => {
	try {
		const r = await pool.query("SELECT 1 AS ok");
		res.json({ ok: true, result: r.rows[0] });
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

app.get("/db/tables", async (_req, res) => {
	try {
		const { rows } = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to list tables" });
	}
});

app.get("/db/counts", async (_req, res) => {
	try {
		const { rows } = await pool.query(`
      SELECT relname AS table, n_live_tup AS approx_rows
      FROM pg_stat_user_tables
      ORDER BY relname;
    `);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to read counts" });
	}
});

// --- USERS ---
app.get("/users", async (_req, res) => {
	try {
		const { rows } = await pool.query(`
      SELECT user_id, email, display_name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 50;
    `);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to fetch users" });
	}
});

app.post("/users", async (req, res) => {
	try {
		const {
			email,
			password_hash = "hash",
			display_name = null,
		} = req.body || {};
		if (!email) return res.status(400).json({ error: "email is required" });

		const { rows } = await pool.query(
			`INSERT INTO users (email, password_hash, display_name)
       VALUES ($1,$2,$3)
       RETURNING user_id, email, display_name, created_at;`,
			[email, password_hash, display_name]
		);
		res.status(201).json(rows[0]);
	} catch (e) {
		if (e.code === "23505")
			return res.status(409).json({ error: "Email already exists" });
		res.status(500).json({ error: "Failed to create user" });
	}
});

// --- EVENTS ---
app.post("/events", async (req, res) => {
	try {
		const {
			host_id,
			title,
			start_time,
			end_time = null,
			location = null,
			content = null,
			visibility = "public",
			capacity = null,
			waitlist = false,
		} = req.body || {};

		if (!isUUID(host_id) || !title || !start_time) {
			return res.status(400).json({
				error: "host_id (uuid), title, start_time are required",
			});
		}
		if (!VISIBILITY.has(visibility)) {
			return res
				.status(400)
				.json({ error: "visibility must be public|private|unlisted" });
		}

		const sql = `
      INSERT INTO events
        (host_id, title, location, start_time, end_time, visibility, capacity, waitlist, content)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING event_id, host_id, title, location, start_time, end_time, visibility, capacity, waitlist, content, created_at
    `;
		const { rows } = await pool.query(sql, [
			host_id,
			title,
			location,
			start_time,
			end_time,
			visibility,
			capacity,
			waitlist,
			content,
		]);
		res.status(201).json(rows[0]);
	} catch (e) {
		if (e.code === "23503")
			return res
				.status(400)
				.json({ error: "Invalid host_id (must exist in users)" });
		res.status(500).json({ error: "Failed to create event" });
	}
});

app.get("/events", async (_req, res) => {
	try {
		const q = `
      SELECT e.event_id, e.title, e.location, e.start_time, e.end_time, e.visibility,
             e.capacity, e.waitlist, e.created_at,
             u.display_name AS host_name, u.user_id AS host_id,
             COALESCE(v.going_count,0) AS going_count,
             COALESCE(v.interested_count,0) AS interested_count,
             COALESCE(v.waitlisted_count,0) AS waitlisted_count
      FROM events e
      JOIN users u ON u.user_id = e.host_id
      LEFT JOIN event_attendance_counts v ON v.event_id = e.event_id
      ORDER BY e.start_time DESC
      LIMIT 100;
    `;
		const { rows } = await pool.query(q);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to list events" });
	}
});

app.get("/events/:id", async (req, res) => {
	try {
		const { id } = req.params;
		if (!isUUID(id))
			return res.status(400).json({ error: "invalid event_id" });

		const q = `
      SELECT e.event_id, e.title, e.location, e.start_time, e.end_time, e.visibility,
             e.capacity, e.waitlist, e.content, e.created_at,
             u.display_name AS host_name, u.user_id AS host_id,
             COALESCE(v.going_count,0) AS going_count,
             COALESCE(v.interested_count,0) AS interested_count,
             COALESCE(v.waitlisted_count,0) AS waitlisted_count
      FROM events e
      JOIN users u ON u.user_id = e.host_id
      LEFT JOIN event_attendance_counts v ON v.event_id = e.event_id
      WHERE e.event_id = $1
      LIMIT 1;
    `;
		const { rows } = await pool.query(q, [id]);
		if (!rows.length)
			return res.status(404).json({ error: "event not found" });
		res.json(rows[0]);
	} catch (e) {
		res.status(500).json({ error: "Failed to fetch event" });
	}
});

// --- RSVPS ---
app.post("/events/:id/rsvp", async (req, res) => {
	try {
		const event_id = req.params.id;
		const {
			user_id,
			status = "interested",
			waitlist_position = null,
		} = req.body || {};

		if (!isUUID(event_id) || !isUUID(user_id)) {
			return res
				.status(400)
				.json({ error: "event_id and user_id must be UUIDs" });
		}
		if (!RSVP_STATUS.has(status)) {
			return res.status(400).json({
				error: "status must be going|waitlisted|interested|cancelled",
			});
		}

		const sql = `
      INSERT INTO rsvps (event_id, user_id, status, waitlist_position)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (event_id, user_id) DO UPDATE
        SET status = EXCLUDED.status,
            waitlist_position = EXCLUDED.waitlist_position
      RETURNING rsvp_id, event_id, user_id, status, waitlist_position, created_at
    `;
		const { rows } = await pool.query(sql, [
			event_id,
			user_id,
			status,
			waitlist_position,
		]);
		res.status(201).json(rows[0]);
	} catch (e) {
		if (e.code === "23503")
			return res
				.status(400)
				.json({ error: "Invalid event_id or user_id (FK constraint)" });
		res.status(500).json({ error: "Failed to upsert RSVP" });
	}
});

app.get("/events/:id/rsvps", async (req, res) => {
	try {
		const event_id = req.params.id;
		const { status } = req.query;

		if (!isUUID(event_id))
			return res.status(400).json({ error: "invalid event_id" });
		if (status && !RSVP_STATUS.has(status)) {
			return res.status(400).json({ error: "invalid status filter" });
		}

		const base = `
      SELECT r.rsvp_id, r.event_id, r.user_id, r.status, r.waitlist_position, r.created_at,
             u.email, u.display_name
      FROM rsvps r
      JOIN users u ON u.user_id = r.user_id
      WHERE r.event_id = $1
    `;
		const sql = status
			? `${base} AND r.status = $2 ORDER BY r.created_at DESC LIMIT 200`
			: `${base} ORDER BY r.created_at DESC LIMIT 200`;
		const params = status ? [event_id, status] : [event_id];

		const { rows } = await pool.query(sql, params);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to list RSVPs" });
	}
});

// --- ANNOUNCEMENTS ---
app.post("/events/:id/announcements", async (req, res) => {
	try {
		const event_id = req.params.id;
		const { host_id, content, scheduled_release = null } = req.body || {};
		if (!isUUID(event_id) || !isUUID(host_id) || !content)
			return res
				.status(400)
				.json({ error: "event_id, host_id (UUID), content required" });

		const { rows } = await pool.query(
			`INSERT INTO announcements (event_id, host_id, content, scheduled_release)
       VALUES ($1,$2,$3,$4)
       RETURNING announcement_id, event_id, content, scheduled_release, created_at`,
			[event_id, host_id, content, scheduled_release]
		);
		res.status(201).json(rows[0]);
	} catch (e) {
		if (e.code === "23503")
			return res
				.status(400)
				.json({ error: "Invalid event_id or host_id" });
		res.status(500).json({ error: "Failed to create announcement" });
	}
});

app.get("/events/:id/announcements", async (req, res) => {
	try {
		const event_id = req.params.id;
		if (!isUUID(event_id))
			return res.status(400).json({ error: "invalid event_id" });

		const { rows } = await pool.query(
			`SELECT announcement_id, event_id, host_id, content, scheduled_release, created_at
       FROM announcements
       WHERE event_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
			[event_id]
		);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to list announcements" });
	}
});

// --- INVITATIONS ---
app.post("/invitations", async (req, res) => {
	try {
		const {
			event_id,
			invited_by,
			mode,
			recipient_email = null,
			message = null,
		} = req.body || {};
		if (!isUUID(event_id) || !isUUID(invited_by) || !mode)
			return res
				.status(400)
				.json({ error: "event_id, invited_by (UUID), mode required" });
		if (!["email", "link"].includes(mode))
			return res.status(400).json({ error: "mode must be email|link" });

		const { rows } = await pool.query(
			`INSERT INTO invitations (event_id, invited_by, mode, recipient_email, message)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING invitation_id, event_id, invited_by, mode, recipient_email, status, created_at`,
			[event_id, invited_by, mode, recipient_email, message]
		);
		res.status(201).json(rows[0]);
	} catch (e) {
		if (e.code === "23503")
			return res
				.status(400)
				.json({ error: "Invalid event_id or invited_by" });
		res.status(500).json({ error: "Failed to create invitation" });
	}
});

app.get("/events/:id/invitations", async (req, res) => {
	try {
		const event_id = req.params.id;
		if (!isUUID(event_id))
			return res.status(400).json({ error: "invalid event_id" });

		const { rows } = await pool.query(
			`SELECT invitation_id, event_id, invited_by, mode, recipient_email, status, created_at
       FROM invitations
       WHERE event_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
			[event_id]
		);
		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: "Failed to list invitations" });
	}
});

// --- Start server & verify DB connectivity once ---
const port = Number(process.env.PORT || 3000);
app.listen(port, async () => {
	try {
		await pool.query("SELECT 1");
		console.log(
			`Server running on http://localhost:${port} (DB: ${
				process.env.POSTGRES_DB ||
				process.env.PGDATABASE ||
				"eventscape"
			} @ ${
				process.env.POSTGRES_SERVICE_HOST ||
				process.env.PGHOST ||
				"127.0.0.1"
			}:${
				process.env.POSTGRES_SERVICE_PORT || process.env.PGPORT || 5433
			})`
		);
	} catch (e) {
		console.error("DB connection failed on startup:", e.message);
		process.exit(1);
	}
});
