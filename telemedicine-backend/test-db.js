require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Full error:', err);
  } else {
    console.log('✅ Connected! Testing query...');
    client.query('SELECT COUNT(*) FROM doctors', (err2, result) => {
      release();
      if (err2) {
        console.error('❌ Query failed:', err2.message);
      } else {
        console.log('✅ Doctors in database:', result.rows[0].count);
      }
      pool.end();
    });
  }
});