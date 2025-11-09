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

passport.serializeUser((user, done) => {
	done(null, {
		user_id: user.user_id,
    email: user.email,
		displayName: user.display_name,
		notificationSetting: user.notification_setting,
	});
});

passport.deserializeUser(async (user, done) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, display_name, notification_setting
       FROM users WHERE email = $1`,
      [user.email]
    );
    if (!rows.length) return done(null, false);
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
const NOTIFICATION_SETTING = new Set(["none","email","in_app","all"]);
const INVITE_MODE = new Set(["email", "link"]);
const INVITE_STATUS = new Set(["pending","accepted","declined","expired"]);
const isUUID = (s) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		s
	);

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.redirect('/login');
}

app.get("/", (req, res) => {
	if (req.session.passport && req.session.passport.user) {
		const email = req.session.passport.user.email;
		return res.render("main", { email });
	}
	res.render("main", { email: null });
});

app.get("/main", (req, res) => {
	res.redirect("/");
});

app.get("/dashboard", (req, res) => {
	if (req.session.passport && req.session.passport.user) {
		const displayName = req.session.passport.user.displayName;
		return res.render("dashboard", { displayName });
	}

	return res.redirect("/login");
});

app.get("/login", (req, res) => {
	if (req.session.passport && req.session.passport.user) {
		return res.redirect("/dashboard");
	}
	res.render("login", {
		error: req.session.messages ? req.session.messages.at(-1) : null,
		email: "",
	});
});

app.post(
	"/login",
	(req, res, next) => {
		if (!req.body.email || !req.body.password) {
			return res.status(400).render("login", {
				error: "Missing fields",
				email: req.body.email || "",
			});
		}
		next();
	},
	passport.authenticate("local", {
		successRedirect: "/dashboard",
		failureRedirect: "/login",
		failureMessage: true,
	})
);

app.get("/register", (req, res) => {
	if (req.session.passport && req.session.passport.user) {
		return res.redirect("/dashboard");
	}
	res.render("register", { error: null });
});

app.post("/register", async (req, res) => {
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

		const displayName = req.body.displayName || "";
		const notificationPref = req.body.notification || "all";

		// Hash the password before saving it to the database
		const salt = await bcrypt.genSalt(15);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Create and save the new user
		const insertResult = await pool.query(
			`INSERT INTO users (email, password_hash, display_name, notification_setting) VALUES ($1, $2, $3, $4) RETURNING user_id`,
			[email, hashedPassword, displayName, notificationPref]
		);

		return res.status(201).render("login", {
			error: null,
			email: email,
		});
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
});

app.get("/post-register", (_req, res) => {
	res.render("post-register");
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error: ", err);
      return next(err);
    }
    req.session.destroy((errSession) => { 
      if (errSession) {
        console.error("Session destroy error: ", err);
      }
      res.clearCookie("connect.sid"); //remove session ID from browser
      return res.redirect("/main");
    })
  })
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

// GET /users/:id: Retrieve a user by id
app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid user_id" });

    const { rows } = await pool.query(`
      SELECT user_id, email, display_name, notification_setting, created_at 
      FROM users 
      WHERE user_id = $1`, 
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(rows[0]);
  } catch (e) {
    console.error("Error fetching user:", e.message);
    res.status(500).json({ error: "Server error: Failed to fetch user" });
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

// PUT /users/:id: Update a user by ID (supports partial update)
app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid user_id" });

    if (req.body.notification_setting && !NOTIFICATION_SETTING.has(req.body.notification_setting)) {
      return res.status(400).json({ error: "Invalid value for notification setting" });
    }

    const retrieveResult = await pool.query(`
      SELECT email, password_hash, display_name, notification_setting 
      FROM users 
      WHERE user_id = $1`, 
      [id]
    );
    if (retrieveResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const existingUser = retrieveResult.rows[0];

    const updatedUser = { 
      email: req.body.email ?? existingUser.email,
      password_hash: req.body.password_hash ?? existingUser.password_hash,
      display_name: req.body.display_name ?? existingUser.display_name,
      notification_setting: req.body.notification_setting ?? existingUser.notification_setting
    }

    const result = await pool.query(`
      UPDATE users 
      SET email = $1,
          password_hash = $2,
          display_name = $3,
          notification_setting = $4 
      WHERE user_id = $5 
      RETURNING user_id, email, display_name, notification_setting, created_at`, 
      [updatedUser.email, updatedUser.password_hash, updatedUser.display_name, updatedUser.notification_setting, id]);
    res.status(200).json(result.rows[0]);
  } catch (e) {
    console.error("Error updating user:", e.message);
    res.status(500).json({ error: "Server error: Failed to update user" });
  }
});

// DELETE /users/:id: Delete a user by ID
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid user_id" });

    const { rows } = await pool.query(`DELETE FROM users WHERE user_id = $1 RETURNING *`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(204).send();
  }
  catch (e) {
    console.error("Error deleting user:", e.message);
    res.status(500).json({ error: "Server error: Failed to delete user" });
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

// GET /events/host/:id: Get all events given host id
app.get("/events/host/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "invalid host_id" });

    const q = `
      SELECT e.event_id, e.title, e.location, e.start_time, e.end_time, e.visibility,
             e.capacity, e.waitlist, e.content, e.created_at,
             COALESCE(v.going_count,0) AS going_count,
             COALESCE(v.interested_count,0) AS interested_count,
             COALESCE(v.waitlisted_count,0) AS waitlisted_count
      FROM events e
      LEFT JOIN event_attendance_counts v ON v.event_id = e.event_id
      WHERE e.host_id = $1
      ORDER BY e.start_time ASC;
    `;
    const { rows } = await pool.query(q, [id]);
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// PUT /events/:id: Update an event by ID (supports partial update)
app.put("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid event_id" });

    if (req.body.visibility && !VISIBILITY.has(req.body.visibility)) {
      return res.status(400).json({ error: "Invalid value for visibility" });
    }

    if (req.body.capacity && (isNaN(parseInt(req.body.capacity, 10)) || req.body.capacity < 0)) {
      return res.status(400).json({ error: "Invalid value for capacity" });
    }

    const retrieveResult = await pool.query(`
      SELECT title, location, start_time, end_time, capacity, waitlist, visibility, content
      FROM events 
      WHERE event_id = $1`, 
      [id]
    );
    if (retrieveResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    const existingEvent = retrieveResult.rows[0];

    const updatedEvent = { 
      title: req.body.title ?? existingEvent.title,
      location: req.body.location ?? existingEvent.location,
      start_time: req.body.start_time ?? existingEvent.start_time,
      end_time: req.body.end_time ?? existingEvent.end_time,
      capacity: req.body.capacity !== undefined ? parseInt(req.body.capacity, 10) : existingEvent.capacity,
      waitlist: req.body.waitlist ?? existingEvent.waitlist,
      visibility: req.body.visibility ?? existingEvent.visibility,
      content: req.body.content ?? existingEvent.content
    }

    const result = await pool.query(`
      UPDATE events 
      SET title = $1,
          location = $2,
          start_time = $3,
          end_time = $4,
          capacity = $5,
          waitlist = $6,
          visibility = $7,
          content = $8
      WHERE event_id = $9 
      RETURNING *`, 
      [updatedEvent.title, updatedEvent.location, updatedEvent.start_time, updatedEvent.end_time, updatedEvent.capacity, updatedEvent.waitlist, updatedEvent.visibility, updatedEvent.content, id]);
    res.status(200).json(result.rows[0]);
  } catch (e) {
    console.error("Error updating event:", e.message);
    res.status(500).json({ error: "Server error: Failed to update event" });
  }
});

// DELETE /events/:id: Delete an event by ID
app.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid event_id" });

    const { rows } = await pool.query(`DELETE FROM events WHERE event_id = $1 RETURNING *`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(204).send();
  }
  catch (e) {
    console.error("Error deleting event:", e.message);
    res.status(500).json({ error: "Server error: Failed to delete event" });
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

// GET /users/:id/rsvps: Get all rsvps for a user
app.get("/users/:id/rsvps", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "invalid user_id" });

    const q = `
      SELECT r.rsvp_id, r.event_id, r.user_id, r.status, r.waitlist_position, r.created_at,
             e.title
      FROM rsvps r
      JOIN events e ON e.event_id = r.event_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `;
    const { rows } = await pool.query(q, [id]);
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch rsvps" });
  }
});

// PUT /rsvps/:id: Update an rsvp by ID (supports partial update)
app.put("/rsvps/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid rsvp_id" });

    if (req.body.status && !RSVP_STATUS.has(req.body.status)) {
      return res.status(400).json({ error: "Invalid value for status" });
    }

    if (req.body.waitlist_position && (isNaN(parseInt(req.body.waitlist_position, 10)) || req.body.waitlist_position < 0)) {
      return res.status(400).json({ error: "Invalid value for waitlist_position" });
    }

    const retrieveResult = await pool.query(`
      SELECT status, waitlist_position
      FROM rsvps 
      WHERE rsvp_id = $1`, 
      [id]
    );
    if (retrieveResult.rows.length === 0) {
      return res.status(404).json({ error: "RSVP not found" });
    }
    const existingRSVP = retrieveResult.rows[0];

    const updatedRSVP = {
      status: req.body.status ?? existingRSVP.status,
      waitlist_position: req.body.waitlist_position !== undefined ? parseInt(req.body.waitlist_position, 10) : existingRSVP.waitlist_position
    }

    const result = await pool.query(`
      UPDATE rsvps 
      SET status = $1,
          waitlist_position = $2
      WHERE rsvp_id = $3 
      RETURNING *`, 
      [updatedRSVP.status, updatedRSVP.waitlist_position, id]);
    res.status(200).json(result.rows[0]);
  } catch (e) {
    console.error("Error updating rsvp:", e.message);
    res.status(500).json({ error: "Server error: Failed to update rsvp" });
  }
});

// DELETE /rsvps/:id: Delete an rsvp by ID
app.delete("/rsvps/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid rsvp_id" });

    const { rows } = await pool.query(`DELETE FROM rsvps WHERE rsvp_id = $1 RETURNING *`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Rsvp not found" });
    }
    res.status(204).send();
  }
  catch (e) {
    console.error("Error deleting rsvp:", e.message);
    res.status(500).json({ error: "Server error: Failed to delete rsvp" });
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

// PUT /announcements/:id: Update an announcement by ID (supports partial update)
app.put("/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid announcement_id" });

    const retrieveResult = await pool.query(`
      SELECT content, scheduled_release
      FROM announcements
      WHERE announcement_id = $1`, 
      [id]
    );
    if (retrieveResult.rows.length === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    const existingAnnouncement = retrieveResult.rows[0];

    const updatedAnnouncement = { 
      content: req.body.content ?? existingAnnouncement.content,
      scheduled_release: req.body.scheduled_release ?? existingAnnouncement.scheduled_release
    }

    const result = await pool.query(`
      UPDATE announcements 
      SET content = $1,
          scheduled_release = $2
      WHERE announcement_id = $3 
      RETURNING *`, 
      [updatedAnnouncement.content, updatedAnnouncement.scheduled_release, id]);
    res.status(200).json(result.rows[0]);
  } catch (e) {
    console.error("Error updating announcement:", e.message);
    res.status(500).json({ error: "Server error: Failed to update announcement" });
  }
});

// DELETE /announcements/:id: Delete an announcement by ID
app.delete("/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid announcement_id" });

    const { rows } = await pool.query(`DELETE FROM announcements WHERE announcement_id = $1 RETURNING *`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.status(204).send();
  }
  catch (e) {
    console.error("Error deleting announcement:", e.message);
    res.status(500).json({ error: "Server error: Failed to delete announcement" });
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
      `SELECT *
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

// GET /invitations/:id: Retrieve an invitation by id
app.get("/invitations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid invitation_id" });

    const { rows } = await pool.query(`
      SELECT *
      FROM invitations 
      WHERE invitation_id = $1`, 
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    res.status(200).json(rows[0]);
  } catch (e) {
    console.error("Error fetching invitation:", e.message);
    res.status(500).json({ error: "Server error: Failed to fetch invitation" });
  }
});

// PUT /invitations/:id: Update an invitation by ID (supports partial update)
app.put("/invitations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "Invalid invitation_id" });

    if (req.body.mode && !INVITE_MODE.has(req.body.mode)) {
      return res.status(400).json({ error: "Invalid value for mode" });
    }

    if (req.body.status && !INVITE_STATUS.has(req.body.status)) {
      return res.status(400).json({ error: "Invalid value for status" });
    }

    const retrieveResult = await pool.query(`
      SELECT mode, recipient_email, message, status, expires_at, accepted_at
      FROM invitations 
      WHERE invitation_id = $1`, 
      [id]
    );
    if (retrieveResult.rows.length === 0) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    const existingInvitation = retrieveResult.rows[0];

    const updatedInvitation = { 
      mode: req.body.mode ?? existingInvitation.mode,
      recipient_email: req.body.recipient_email ?? existingInvitation.recipient_email,
      message: req.body.message ?? existingInvitation.message,
      status: req.body.status ?? existingInvitation.status,
      expires_at: req.body.expires_at ?? existingInvitation.expires_at,
      accepted_at: req.body.accepted_at ?? existingInvitation.accepted_at
    }

    const result = await pool.query(`
      UPDATE invitations 
      SET mode = $1,
          recipient_email = $2,
          message = $3,
          status = $4,
          expires_at = $5,
          accepted_at = $6
      WHERE invitation_id = $7 
      RETURNING *`, 
      [updatedInvitation.mode, updatedInvitation.recipient_email, updatedInvitation.message, updatedInvitation.status, updatedInvitation.expires_at, updatedInvitation.accepted_at, id]);
    res.status(200).json(result.rows[0]);
  } catch (e) {
    console.error("Error updating invitation:", e.message);
    res.status(500).json({ error: "Server error: Failed to update invitation" });
  }
});

app.get('/profile', ensureAuth, (req, res) => {
  res.render('dashboard', {
    displayName: req.user.display_name,
    email: req.user.email,
    notification_setting: req.user.notification_setting,
    panel: 'profile',
    saved: req.query.saved === '1'
  });
});

app.post('/profile/notification', ensureAuth, async (req, res) => {
  try {
    const pref = (req.body.notification_setting || '').toLowerCase();
    if (!NOTIFICATION_SETTING.has(pref)) {
      return res.status(400).send('Invalid notification preference.');
    }

    await pool.query(
      'UPDATE users SET notification_setting = $1 WHERE user_id = $2',
      [pref, req.user.user_id]
    );

    req.user.notification_setting = pref;
    if (req.session?.passport?.user) {
      req.session.passport.user.notification_setting = pref;
    }

    return res.redirect('/profile?saved=1');
  } catch (err) {
    console.error('Failed to update notification setting:', err);
    return res.status(500).send('Could not update notification setting.');
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
