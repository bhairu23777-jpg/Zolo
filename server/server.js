const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: {
rejectUnauthorized: false
}
});

// Initialize database
async function initializeDatabase() {

// Users table
await pool.query(`     CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      mobile VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

// Student profiles table
await pool.query(`     CREATE TABLE IF NOT EXISTS student_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,
      father_name VARCHAR(100),
      mother_name VARCHAR(100),
      medium VARCHAR(20),
      target_year VARCHAR(20),
      photo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

console.log("Database tables ready");
}

// Health check
app.get("/api/health", async (req, res) => {
try {

```
const result = await pool.query("SELECT NOW()");

res.json({
  success: true,
  message: "Zolo API + Database is running 🚀",
  database: "connected",
  time: result.rows[0].now
});
```

} catch (error) {

```
console.error("Health check error:", error);

res.status(500).json({
  success: false,
  message: "Database connection failed"
});
```

}
});

// Signup API
app.post("/api/signup", async (req, res) => {
try {

```
const {
  full_name,
  mobile,
  email,
  password
} = req.body;

// Required fields
if (!full_name || !mobile || !email || !password) {
  return res.status(400).json({
    success: false,
    message: "All fields are required"
  });
}

// Password validation
if (password.length < 6) {
  return res.status(400).json({
    success: false,
    message: "Password must be at least 6 characters"
  });
}

// Check existing user
const existingUser = await pool.query(
  `
  SELECT id
  FROM users
  WHERE email = $1 OR mobile = $2
  `,
  [email, mobile]
);

if (existingUser.rows.length > 0) {
  return res.status(409).json({
    success: false,
    message: "Email or mobile already registered"
  });
}

// Hash password
const passwordHash = await bcrypt.hash(password, 12);

// Create user
const result = await pool.query(
  `
  INSERT INTO users
  (full_name, mobile, email, password_hash)
  VALUES ($1, $2, $3, $4)
  RETURNING
    id,
    full_name,
    mobile,
    email,
    created_at
  `,
  [
    full_name,
    mobile,
    email,
    passwordHash
  ]
);

res.status(201).json({
  success: true,
  message: "Account created successfully 🎉",
  user: result.rows[0]
});
```

} catch (error) {

```
console.error("Signup error:", error);

res.status(500).json({
  success: false,
  message: "Signup failed"
});
```

}
});

// Login API
app.post("/api/login", async (req, res) => {
try {

```
const { email, password } = req.body;

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
    password_hash
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

const passwordMatch = await bcrypt.compare(
  password,
  user.password_hash
);

if (!passwordMatch) {
  return res.status(401).json({
    success: false,
    message: "Invalid email or password"
  });
}

res.json({
  success: true,
  message: "Login successful 🎉",
  user: {
    id: user.id,
    full_name: user.full_name,
    mobile: user.mobile,
    email: user.email
  }
});
```

} catch (error) {

```
console.error("Login error:", error);

res.status(500).json({
  success: false,
  message: "Login failed"
});
```

}
});
// Save / Update Student Profile
app.post("/api/profile", async (req, res) => {
  try {

    const {
      user_id,
      father_name,
      mother_name,
      medium,
      target_year
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO student_profiles
      (
        user_id,
        father_name,
        mother_name,
        medium,
        target_year
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        father_name = EXCLUDED.father_name,
        mother_name = EXCLUDED.mother_name,
        medium = EXCLUDED.medium,
        target_year = EXCLUDED.target_year,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        user_id,
        father_name || null,
        mother_name || null,
        medium || null,
        target_year || null
      ]
    );

    res.json({
      success: true,
      message: "Profile saved successfully 🎉",
      profile: result.rows[0]
    });

  } catch (error) {

    console.error("Profile save error:", error);

    res.status(500).json({
      success: false,
      message: "Profile save failed"
    });

  }
});

// Test Results API
app.post("/api/results", async (req, res) => {
  try {

    const {
      user_id,
      subject,
      total_questions,
      attempted,
      correct,
      wrong,
      score
    } = req.body;

    if (!user_id || !subject) {
      return res.status(400).json({
        success: false,
        message: "User ID and subject are required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO test_results
      (
        user_id,
        subject,
        total_questions,
        attempted,
        correct,
        wrong,
        score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        user_id,
        subject,
        total_questions || 0,
        attempted || 0,
        correct || 0,
        wrong || 0,
        score || 0
      ]
    );

    res.status(201).json({
      success: true,
      message: "Test result saved successfully 🎉",
      result: result.rows[0]
    });

  } catch (error) {

    console.error("Result save error:", error);

    res.status(500).json({
      success: false,
      message: "Result save failed"
    });

  }
});

// Server
const PORT = process.env.PORT || 3000;

initializeDatabase()
.then(() => {

```
app.listen(PORT, () => {
  console.log(`Zolo server running on port ${PORT}`);
});
```

})
.catch((error) => {

```
console.error(
  "Database initialization failed:",
  error
);

process.exit(1);
```

});
