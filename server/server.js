const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create users table
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      mobile VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Users table ready");
}

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Zolo API + Database is running 🚀",
      database: "connected",
      time: result.rows[0].now
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { full_name, mobile, email, password } = req.body;

    if (!full_name || !mobile || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR mobile = $2",
      [email, mobile]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email or mobile already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, mobile, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, mobile, email, created_at`,
      [full_name, mobile, email, passwordHash]
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully 🎉",
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Zolo server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
