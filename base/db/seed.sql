-- Users
INSERT INTO users (email, password_hash, display_name)
VALUES ('demo@example.com','hash','Demo User')
RETURNING user_id \gset

-- Events (hosted by the user above)
INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Morning Yoga in the Park', 'High Park, Toronto', now() + interval '1 day', now() + interval '1 day 1 hour', 'public');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Tech Talk: AI and the Future', 'MaRS Discovery District, Toronto', now() + interval '2 days 15 hours', now() + interval '2 days 17 hours', 'public');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Sunday Brunch Meetup', 'Café Cancan, Toronto', now() + interval '3 days 10 hours', now() + interval '3 days 12 hours', 'private');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Movie Night: Interstellar', 'Cineplex Queensway, Toronto', now() + interval '4 days 19 hours', now() + interval '4 days 22 hours', 'public');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Hackathon Kickoff', 'UofT Bahen Centre, Toronto', now() + interval '5 days 9 hours', now() + interval '5 days 21 hours', 'public');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Art Gallery Tour', 'AGO, Toronto', now() + interval '6 days 13 hours', now() + interval '6 days 15 hours', 'private');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Live Music: Indie Night', 'Horseshoe Tavern, Toronto', now() + interval '7 days 20 hours', now() + interval '7 days 23 hours', 'public');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Community Cleanup', 'Trinity Bellwoods Park, Toronto', now() + interval '8 days 8 hours', now() + interval '8 days 11 hours', 'public');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Photography Workshop', 'Downtown Studio, Toronto', now() + interval '9 days 14 hours', now() + interval '9 days 16 hours', 'private');

INSERT INTO events (host_id, title, location, start_time, end_time, visibility)
VALUES (:'user_id', 'Board Game Night', 'Snakes & Lattes Annex, Toronto', now() + interval '10 days 18 hours', now() + interval '10 days 22 hours', 'public');


-- Announcements
INSERT INTO announcements (event_id, host_id, content, scheduled_release)
VALUES (:'event_id', :'user_id', 'Welcome to Demo Event!', now() + interval '10 minutes');

-- RSVP (same user)
INSERT INTO rsvps (event_id, user_id, status) VALUES (:'event_id', :'user_id', 'going');

-- Invitation
INSERT INTO invitations (event_id, invited_by, mode, recipient_email, message)
VALUES (:'event_id', :'user_id', 'email', 'friend@example.com', 'Join us!');
