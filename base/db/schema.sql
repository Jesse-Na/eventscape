-- Eventscape baseline schema for PostgreSQL
-- Requires official Postgres image (extensions available by default)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE visibility_enum AS ENUM ('public','private','unlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_status_enum AS ENUM ('going','waitlisted','interested','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invite_mode_enum AS ENUM ('email','link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invite_status_enum AS ENUM ('pending','accepted','declined','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notif_pref_enum AS ENUM ('none','email','in_app','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notif_type_enum AS ENUM ('announcement','invitation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Tables =====

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 CITEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  display_name          TEXT,
  notification_setting  notif_pref_enum NOT NULL DEFAULT 'all',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  event_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  location        TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  capacity        INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  waitlist        BOOLEAN NOT NULL DEFAULT FALSE,
  visibility      visibility_enum NOT NULL DEFAULT 'public',
  content         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_host       ON events(host_id);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_time       ON events(start_time);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  announcement_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  host_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  scheduled_release TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_event ON announcements(event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_sched ON announcements(scheduled_release);

-- RSVPs
CREATE TABLE IF NOT EXISTS rsvps (
  rsvp_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id           UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status             rsvp_status_enum NOT NULL DEFAULT 'interested',
  waitlist_position  INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rsvps_event_status ON rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_waitlist     ON rsvps(event_id, waitlist_position)
  WHERE waitlist_position IS NOT NULL;

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  invitation_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  mode            invite_mode_enum NOT NULL,
  recipient_email CITEXT,
  message         TEXT,
  status          invite_status_enum NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_invites_event  ON invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invites_email  ON invitations(recipient_email);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  notification_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  title             TEXT,
  message           TEXT,
  is_read           BOOLEAN NOT NULL DEFAULT FALSE,
  type              notif_type_enum NOT NULL,
  announcement_id   UUID REFERENCES announcements(announcement_id) ON DELETE CASCADE,
  invitation_id     UUID REFERENCES invitations(invitation_id) ON DELETE CASCADE,
  CHECK ((announcement_id IS NOT NULL)::int + (invitation_id IS NOT NULL)::int <= 1)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);

-- ===== Triggers to keep updated_at fresh =====
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Optional view for quick counts =====
CREATE OR REPLACE VIEW event_attendance_counts AS
SELECT
  e.event_id,
  COUNT(*) FILTER (WHERE r.status = 'going')      AS going_count,
  COUNT(*) FILTER (WHERE r.status = 'interested') AS interested_count,
  COUNT(*) FILTER (WHERE r.status = 'waitlisted') AS waitlisted_count
FROM events e
LEFT JOIN rsvps r ON r.event_id = e.event_id
GROUP BY e.event_id;
