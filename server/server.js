const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

/* ==========================================
MIDDLEWARE
========================================== */

app.use(cors());

app.use(express.json());

/* ==========================================
DATABASE
========================================== */

const pool = new Pool({
connectionString: process.env.DATABASE_URL,

ssl: {
rejectUnauthorized: false
}
});

/* ==========================================
DATABASE INITIALIZATION
========================================== */

async function initializeDatabase() {

try {

```
/* USERS */

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


/* STUDENT PROFILES */

await pool.query(`
  CREATE TABLE IF NOT EXISTS student_profiles (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL UNIQUE
      REFERENCES users(id)
      ON DELETE CASCADE,

    father_name VARCHAR(100),

    mother_name VARCHAR(100),

    medium VARCHAR(20),

    target_year VARCHAR(20),

    photo_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);


/* TEST RESULTS */

await pool.query(`
  CREATE TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,

    subject VARCHAR(30) NOT NULL,

    total_questions INTEGER NOT NULL DEFAULT 0,

    attempted INTEGER NOT NULL DEFAULT 0,

    correct INTEGER NOT NULL DEFAULT 0,

    wrong INTEGER NOT NULL DEFAULT 0,

    score INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);


console.log(
  "Database tables initialized successfully"
);
```

} catch (error) {

```
console.error(
  "Database initialization error:",
  error
);
```

}

}

/* ==========================================
HEALTH CHECK
========================================== */

app.get("/api/health", async (req, res) => {

try {

```
await pool.query("SELECT 1");

res.json({

  success: true,

  message:
    "Zolo API + Database is running 🚀",

  database:
    "connected",

  time:
    new Date().toISOString()

});
```

} catch (error) {

```
console.error(
  "Health check error:",
  error
);

res.status(500).json({

  success: false,

  message:
    "Database connection failed",

  database:
    "disconnected"

});
```

}

});

/* ==========================================
SIGNUP
========================================== */

app.post("/api/signup", async (req, res) => {

try {

```
const {
  full_name,
  mobile,
  email,
  password
} = req.body;


if (
  !full_name ||
  !mobile ||
  !email ||
  !password
) {

  return res.status(400).json({

    success: false,

    message:
      "All fields are required"

  });

}


const normalizedEmail =
  email.trim().toLowerCase();


const existingUser =
  await pool.query(
    `
    SELECT id
    FROM users
    WHERE email = $1
       OR mobile = $2
    `,
    [
      normalizedEmail,
      mobile.trim()
    ]
  );


if (
  existingUser.rows.length > 0
) {

  return res.status(409).json({

    success: false,

    message:
      "Email or mobile already registered"

  });

}


const passwordHash =
  await bcrypt.hash(
    password,
    10
  );


const result =
  await pool.query(
    `
    INSERT INTO users
    (
      full_name,
      mobile,
      email,
      password_hash
    )
    VALUES
    ($1, $2, $3, $4)
    RETURNING
      id,
      full_name,
      mobile,
      email,
      created_at
    `,
    [
      full_name.trim(),
      mobile.trim(),
      normalizedEmail,
      passwordHash
    ]
  );


res.status(201).json({

  success: true,

  message:
    "Account created successfully 🎉",

  user:
    result.rows[0]

});
```

} catch (error) {

```
console.error(
  "Signup error:",
  error
);


res.status(500).json({

  success: false,

  message:
    "Signup failed"

});
```

}

});

/* ==========================================
LOGIN
========================================== */

app.post("/api/login", async (req, res) => {

try {

```
const {
  email,
  password
} = req.body;


if (
  !email ||
  !password
) {

  return res.status(400).json({

    success: false,

    message:
      "Email and password are required"

  });

}


const normalizedEmail =
  email.trim().toLowerCase();


const result =
  await pool.query(
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
    [normalizedEmail]
  );


if (
  result.rows.length === 0
) {

  return res.status(401).json({

    success: false,

    message:
      "Invalid email or password"

  });

}


const user =
  result.rows[0];


const passwordMatch =
  await bcrypt.compare(
    password,
    user.password_hash
  );


if (!passwordMatch) {

  return res.status(401).json({

    success: false,

    message:
      "Invalid email or password"

  });

}


delete user.password_hash;


res.json({

  success: true,

  message:
    "Login successful 🎉",

  user

});
```

} catch (error) {

```
console.error(
  "Login error:",
  error
);


res.status(500).json({

  success: false,

  message:
    "Login failed"

});
```

}

});

/* ==========================================
SAVE / UPDATE PROFILE
========================================== */

app.post("/api/profile", async (req, res) => {

try {

```
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

    message:
      "User ID is required"

  });

}


const result =
  await pool.query(
    `
    INSERT INTO student_profiles
    (
      user_id,
      father_name,
      mother_name,
      medium,
      target_year
    )
    VALUES
    ($1, $2, $3, $4, $5)

    ON CONFLICT (user_id)

    DO UPDATE SET

      father_name =
        EXCLUDED.father_name,

      mother_name =
        EXCLUDED.mother_name,

      medium =
        EXCLUDED.medium,

      target_year =
        EXCLUDED.target_year,

      updated_at =
        CURRENT_TIMESTAMP

    RETURNING *
    `,
    [
      user_id,

      father_name ||
        null,

      mother_name ||
        null,

      medium ||
        null,

      target_year ||
        null
    ]
  );


res.json({

  success: true,

  message:
    "Profile saved successfully 🎉",

  profile:
    result.rows[0]

});
```

} catch (error) {

```
console.error(
  "Profile save error:",
  error
);


res.status(500).json({

  success: false,

  message:
    "Profile save failed"

});
```

}

});

/* ==========================================
GET PROFILE
========================================== */

app.get(
"/api/profile/:user_id",
async (req, res) => {

```
try {

  const {
    user_id
  } = req.params;


  const result =
    await pool.query(
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
        p.photo_url,
        p.created_at,
        p.updated_at

      FROM users u

      LEFT JOIN student_profiles p
        ON u.id = p.user_id

      WHERE u.id = $1
      `,
      [user_id]
    );


  if (
    result.rows.length === 0
  ) {

    return res.status(404).json({

      success: false,

      message:
        "User not found"

    });

  }


  res.json({

    success: true,

    profile:
      result.rows[0]

  });

} catch (error) {

  console.error(
    "Profile fetch error:",
    error
  );


  res.status(500).json({

    success: false,

    message:
      "Profile fetch failed"

  });

}
```

}
);

/* ==========================================
SAVE TEST RESULT
========================================== */

app.post("/api/results", async (req, res) => {

try {

```
const {
  user_id,
  subject,
  total_questions,
  attempted,
  correct,
  wrong,
  score
} = req.body;


if (
  !user_id ||
  !subject
) {

  return res.status(400).json({

    success: false,

    message:
      "User ID and subject are required"

  });

}


const result =
  await pool.query(
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
    VALUES
    ($1, $2, $3, $4, $5, $6, $7)

    RETURNING *
    `,
    [
      user_id,

      subject,

      total_questions ||
        0,

      attempted ||
        0,

      correct ||
        0,

      wrong ||
        0,

      score ||
        0
    ]
  );


res.status(201).json({

  success: true,

  message:
    "Test result saved successfully 🎉",

  result:
    result.rows[0]

});
```

} catch (error) {

```
console.error(
  "Result save error:",
  error
);


res.status(500).json({

  success: false,

  message:
    "Result save failed"

});
```

}

});

/* ==========================================
GET ALL TEST RESULTS
========================================== */

app.get(
"/api/results/:user_id",
async (req, res) => {

```
try {

  const {
    user_id
  } = req.params;


  const result =
    await pool.query(
      `
      SELECT
        id,
        subject,
        total_questions,
        attempted,
        correct,
        wrong,
        score,
        created_at

      FROM test_results

      WHERE user_id = $1

      ORDER BY created_at DESC
      `,
      [user_id]
    );


  res.json({

    success: true,

    results:
      result.rows

  });

} catch (error) {

  console.error(
    "Results fetch error:",
    error
  );


  res.status(500).json({

    success: false,

    message:
      "Results fetch failed"

  });

}
```

}
);

/* ==========================================
SERVER
========================================== */

async function startServer() {

await initializeDatabase();

app.listen(
PORT,
() => {

```
  console.log(
    `Zolo server running on port ${PORT}`
  );

}
```

);

}

startServer();
