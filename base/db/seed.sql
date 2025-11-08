-- Users
INSERT INTO users (email, password_hash, display_name)
VALUES ('demo@example.com','hash','Demo User')
RETURNING user_id \gset

-- Events (hosted by the user above)
INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Demo Event', 'Toronto', now(), now() + interval '1 hour', 'public')
RETURNING event_id \gset

-- Announcements
INSERT INTO announcements (event_id, host_id, content, scheduled_release)
VALUES (:'event_id', :'user_id', 'Welcome to Demo Event!', now() + interval '10 minutes');

-- RSVP (same user)
INSERT INTO rsvps (event_id, user_id, status) VALUES (:'event_id', :'user_id', 'going');

-- Invitation
INSERT INTO invitations (event_id, invited_by, mode, recipient_email, message)
VALUES (:'event_id', :'user_id', 'email', 'friend@example.com', 'Join us!');
