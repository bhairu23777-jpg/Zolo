javascript
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing");
}

if (!JWT_SECRET) {
  console.error("JWT_SECRET is missing");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

// --------------------------------------------------
// DATABASE
// --------------------------------------------------

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      mobile VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      father_name VARCHAR(150),
      mother_name VARCHAR(150),
      medium VARCHAR(20),
      target_year VARCHAR(20),
      photo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS test_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(50) NOT NULL,
      chapter VARCHAR(150),
      total_questions INTEGER NOT NULL,
      attempted INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      wrong INTEGER DEFAULT 0,
      unanswered INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Database tables ready");
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const token = header.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired login session"
    });
  }
}

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "Zolo API + Database is running 🚀",
      database: "connected",
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// --------------------------------------------------
// SIGNUP
// --------------------------------------------------

app.post("/api/signup", async (req, res) => {
  try {
    let {
      full_name,
      mobile,
      email,
      password
    } = req.body;

    full_name = String(full_name || "").trim();
    mobile = String(mobile || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

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

    const existing = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1 OR mobile = $2
      `,
      [email, mobile]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email or mobile already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users
      (full_name, mobile, email, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, mobile, email, created_at
      `,
      [
        full_name,
        mobile,
        email,
        passwordHash
      ]
    );

    const user = result.rows[0];

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during signup"
    });
  }
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post("/api/login", async (req, res) => {
  try {
    let {
      email,
      password
    } = req.body;

    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        mobile,
        email,
        password_hash,
        created_at
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    delete user.password_hash;

    const token = createToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
});

// --------------------------------------------------
// CURRENT USER
// --------------------------------------------------

app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        mobile,
        email,
        created_at
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Me error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load account"
    });
  }
});

// --------------------------------------------------
// PROFILE SAVE
// --------------------------------------------------

app.post("/api/profile", authMiddleware, async (req, res) => {
  try {
    const {
      father_name,
      mother_name,
      medium,
      target_year,
      photo_url
    } = req.body;

    await pool.query(
      `
      INSERT INTO student_profiles
      (
        user_id,
        father_name,
        mother_name,
        medium,
        target_year,
        photo_url
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id)
      DO UPDATE SET
        father_name = EXCLUDED.father_name,
        mother_name = EXCLUDED.mother_name,
        medium = EXCLUDED.medium,
        target_year = EXCLUDED.target_year,
        photo_url = EXCLUDED.photo_url,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.user.id,
        father_name || null,
        mother_name || null,
        medium || null,
        target_year || null,
        photo_url || null
      ]
    );

    res.json({
      success: true,
      message: "Profile saved successfully"
    });
  } catch (error) {
    console.error("Profile save error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to save profile"
    });
  }
});

// --------------------------------------------------
// PROFILE GET
// --------------------------------------------------

app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.mobile,
        u.email,
        p.father_name,
        p.mother_name,
        p.medium,
        p.target_year,
        p.photo_url
      FROM users u
      LEFT JOIN student_profiles p
        ON p.user_id = u.id
      WHERE u.id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }

    res.json({
      success: true,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error("Profile get error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load profile"
    });
  }
});

// --------------------------------------------------
// SAVE TEST RESULT
// --------------------------------------------------

app.post("/api/results", authMiddleware, async (req, res) => {
  try {
    const {
      subject,
      chapter,
      total_questions,
      attempted,
      correct,
      wrong,
      unanswered,
      score
    } = req.body;

    const total = Number(total_questions);
    const attemptedCount = Number(attempted || 0);
    const correctCount = Number(correct || 0);
    const wrongCount = Number(wrong || 0);
    const unansweredCount = Number(unanswered || 0);
    const finalScore = Number(score || 0);

    if (!subject || !Number.isInteger(total) || total <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid test result"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO test_results
      (
        user_id,
        subject,
        chapter,
        total_questions,
        attempted,
        correct,
        wrong,
        unanswered,
        score
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        req.user.id,
        subject,
        chapter || null,
        total,
        attemptedCount,
        correctCount,
        wrongCount,
        unansweredCount,
        finalScore
      ]
    );

    res.status(201).json({
      success: true,
      message: "Test result saved",
      result: result.rows[0]
    });
  } catch (error) {
    console.error("Result save error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to save test result"
    });
  }
});

// --------------------------------------------------
// TEST HISTORY
// --------------------------------------------------

app.get("/api/results", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        subject,
        chapter,
        total_questions,
        attempted,
        correct,
        wrong,
        unanswered,
        score,
        created_at
      FROM test_results
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      count: result.rows.length,
      results: result.rows
    });
  } catch (error) {
    console.error("Results history error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load test history"
    });
  }
});

// --------------------------------------------------
// SINGLE RESULT
// --------------------------------------------------

app.get("/api/results/:id", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        subject,
        chapter,
        total_questions,
        attempted,
        correct,
        wrong,
        unanswered,
        score,
        created_at
      FROM test_results
      WHERE id = $1
        AND user_id = $2
      `,
      [
        req.params.id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Result not found"
      });
    }

    res.json({
      success: true,
      result: result.rows[0]
    });
  } catch (error) {
    console.error("Single result error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load result"
    });
  }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Zolo server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();

