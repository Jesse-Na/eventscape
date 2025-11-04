const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const pool = require("./db.js");

passport.use(
	new LocalStrategy(async (email, password, done) => {
		try {
			// Find the user by email in the database
			const { rows } = await pool.query(
				`select * from users where email = $1`,
				[email]
			);

			if (rows.length === 0) {
				return done(null, false, { error: "User doesn't exist" });
			}

			const user = rows[0];
			// Compare the provided password with the
			// hashed password in the database
			const isMatch = await bcrypt.compare(password, user.password_hash);

			// If the passwords match, return the user object
			if (isMatch) {
				return done(null, user);
			} else {
				// If the passwords don't match, return an error
				return done(null, false, { error: "Incorrect password" });
			}
		} catch (err) {
			return done(err);
		}
	})
);
