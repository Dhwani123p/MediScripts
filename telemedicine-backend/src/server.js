const http    = require('http');
const express = require('express');
const { ExpressPeerServer } = require('peer');
const pool = require('./config/database');
const cors = require('cors');
require('dotenv').config({ quiet: true, override: false });

// ── Auto-migration: create tables if they don't exist ─────────────────────────
const runMigrations = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        email      TEXT NOT NULL UNIQUE,
        password   TEXT NOT NULL,
        full_name  TEXT NOT NULL,
        role       TEXT NOT NULL CHECK (role IN ('patient', 'doctor')),
        phone      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id               SERIAL PRIMARY KEY,
        user_id          INT REFERENCES users(id) ON DELETE CASCADE,
        full_name        TEXT NOT NULL,
        specialty        TEXT NOT NULL DEFAULT 'General Physician',
        qualification    TEXT,
        experience       INT DEFAULT 0,
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
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id               SERIAL PRIMARY KEY,
        patient_id       INT REFERENCES users(id) ON DELETE CASCADE,
        doctor_id        INT REFERENCES doctors(id) ON DELETE SET NULL,
        appointment_date TIMESTAMPTZ NOT NULL,
        appointment_type TEXT NOT NULL DEFAULT 'video',
        status           TEXT NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','completed','cancelled')),
        notes            TEXT,
        prescription     TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id              SERIAL PRIMARY KEY,
        patient_id      INT REFERENCES users(id) ON DELETE CASCADE,
        doctor_id       INT REFERENCES doctors(id) ON DELETE SET NULL,
        medication      TEXT NOT NULL,
        dosage          TEXT,
        instructions    TEXT,
        status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','cancelled')),
        prescribed_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Indexes (safe to run repeatedly)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS health_profiles (
        id                      SERIAL PRIMARY KEY,
        user_id                 INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        date_of_birth           DATE,
        gender                  TEXT,
        blood_group             TEXT,
        height_cm               NUMERIC(5,1),
        weight_kg               NUMERIC(5,1),
        allergies               TEXT,
        current_medications     TEXT,
        chronic_conditions      TEXT,
        past_surgeries          TEXT,
        family_history          TEXT,
        emergency_contact_name  TEXT,
        emergency_contact_phone TEXT,
        updated_at              TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_patient  ON appointments(patient_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_doctor   ON appointments(doctor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_doctors_specialty     ON doctors(specialty)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_health_profiles_user  ON health_profiles(user_id)`);
    console.log('✅ Database tables verified/created');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
};
runMigrations();

// Import routes
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const userRoutes = require('./routes/users');
const prescriptionRoutes  = require('./routes/prescriptions');
const healthProfileRoutes = require('./routes/health-profile');
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(u => u.trim()) : [])
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow all Vercel preview + production deployments
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow localhost for development
    if (origin.startsWith('http://localhost')) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/prescriptions',  prescriptionRoutes);
app.use('/api/health-profile', healthProfileRoutes);
// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT   = process.env.PORT || 5000;
const server = http.createServer(app);

// PeerJS signaling server — used for WebRTC video calls
const peerServer = ExpressPeerServer(server, { debug: false });
app.use('/peerjs', peerServer);

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});