-- ============================================================
-- MediScript — Supabase / PostgreSQL Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  email        TEXT    NOT NULL UNIQUE,
  password     TEXT    NOT NULL,
  full_name    TEXT    NOT NULL,
  role         TEXT    NOT NULL CHECK (role IN ('patient', 'doctor')),
  phone        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Doctors (extended profile, one row per doctor user) ──────
CREATE TABLE IF NOT EXISTS doctors (
  id               SERIAL PRIMARY KEY,
  user_id          INT REFERENCES users(id) ON DELETE CASCADE,
  full_name        TEXT    NOT NULL,
  specialty        TEXT    NOT NULL DEFAULT 'General Physician',
  qualification    TEXT,
  experience       INT     DEFAULT 0,    -- years
  hospital         TEXT,
  location         TEXT,
  consultation_fee NUMERIC(10,2) DEFAULT 0,
  rating           NUMERIC(3,2)  DEFAULT 4.5,
  available        BOOLEAN DEFAULT TRUE,
  avatar_url       TEXT,
  bio              TEXT,
  languages        TEXT,
  next_available   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Appointments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               SERIAL PRIMARY KEY,
  patient_id       INT REFERENCES users(id) ON DELETE CASCADE,
  doctor_id        INT REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_date TIMESTAMPTZ NOT NULL,
  appointment_type TEXT    NOT NULL DEFAULT 'video',
  status           TEXT    NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','completed','cancelled')),
  notes            TEXT,
  prescription     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Prescriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id               SERIAL PRIMARY KEY,
  patient_id       INT REFERENCES users(id) ON DELETE CASCADE,
  doctor_id        INT REFERENCES doctors(id) ON DELETE SET NULL,
  medication       TEXT    NOT NULL,
  dosage           TEXT,
  instructions     TEXT,
  diagnosis        TEXT,
  medications_json TEXT,
  interactions     JSONB   NOT NULL DEFAULT '[]',
  status           TEXT    NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','completed','cancelled')),
  prescribed_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration for existing deployments (safe to run on a schema that already has the table):
-- ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS diagnosis        TEXT;
-- ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS medications_json TEXT;
-- ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS interactions     JSONB NOT NULL DEFAULT '[]';

-- ── Indexes for common queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_patient  ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor   ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty     ON doctors(specialty);

-- ── Sample doctors (optional — run to populate the doctors list) ──
-- INSERT INTO users (email, password, full_name, role) VALUES
--   ('dr.sharma@mediscript.com', 'hashed_password', 'Dr. Priya Sharma', 'doctor'),
--   ('dr.khan@mediscript.com',   'hashed_password', 'Dr. Arjun Khan',   'doctor');
--
-- INSERT INTO doctors (user_id, full_name, specialty, qualification, experience, hospital, location, consultation_fee, rating, avatar_url) VALUES
--   (1, 'Dr. Priya Sharma', 'Cardiologist',     'MBBS, MD (Cardiology)',  12, 'Apollo Hospital',   'Mumbai',    800,  4.8, NULL),
--   (2, 'Dr. Arjun Khan',   'General Physician', 'MBBS, DNB (Medicine)',   8,  'Fortis Healthcare', 'Bangalore', 500,  4.6, NULL);
