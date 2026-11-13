
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import multer from "multer";

import pool from "./db.js";
import { requireAdmin } from "./middleware.js";
import { sendEnquiryEmail } from "./mailer.js";

const app = express();
const port = Number(process.env.PORT || 5000);

const publicApiUrl = (
  process.env.API_PUBLIC_URL || `http://localhost:${port}/api`
).replace(/\/$/, "");

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// --------------------------------------------------
// SECURITY AND MIDDLEWARE
// --------------------------------------------------

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(express.json({ limit: "150kb" }));

// --------------------------------------------------
// IMAGE UPLOAD CONFIGURATION
// --------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG and WebP images are allowed.")
      );
    }

    callback(null, true);
  }
});

// --------------------------------------------------
// RATE LIMITING
// --------------------------------------------------

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.use(
  "/api/enquiries",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const clean = (value, max = 2000) =>
  String(value ?? "").trim().slice(0, max);

const safeUrl = value => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const projectCategories = [
  "New Construction",
  "Renovation",
  "Civil Work",
  "Commercial",
  "Residential"
];

const enquiryTypes = [
  "New Construction",
  "Renovation",
  "Civil Work",
  "Commercial",
  "Other"
];

const enquiryStatuses = [
  "New",
  "Contacted",
  "Site Visit",
  "Quoted",
  "Won",
  "Closed"
];

// --------------------------------------------------
// GET ONE PROJECT
// --------------------------------------------------

async function getProject(id) {
  const [rows] = await pool.execute(
    `SELECT
      id,
      title,
      category,
      location,
      description,
      CASE
        WHEN image_data IS NOT NULL
        THEN CONCAT(?, '/projects/', id, '/image')
        ELSE image_url
      END AS imageUrl,
      featured,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM projects
    WHERE id = ?`,
    [publicApiUrl, id]
  );

  if (!rows.length) return null;

  const [images] = await pool.execute(
    "SELECT image_url FROM project_images WHERE project_id = ? ORDER BY id",
    [id]
  );

  return {
    ...rows[0],
    gallery: images.map(image => image.image_url)
  };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "RK Construction API"
  });
});

// --------------------------------------------------
// SERVE PROJECT IMAGE FROM MYSQL
// --------------------------------------------------

app.get("/api/projects/:id/image", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid project ID."
      });
    }

    const [rows] = await pool.execute(
      `SELECT image_data, image_mime_type
       FROM projects
       WHERE id = ?`,
      [id]
    );

    if (!rows.length || !rows[0].image_data) {
      return res.status(404).json({
        message: "Image not found."
      });
    }

    res.setHeader("Content-Type", rows[0].image_mime_type);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.send(rows[0].image_data);

  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// GET ALL PROJECTS
// --------------------------------------------------

app.get("/api/projects", async (req, res, next) => {
  try {
    let sql = `
      SELECT
        id,
        title,
        category,
        location,
        description,
        CASE
          WHEN image_data IS NOT NULL
          THEN CONCAT(?, '/projects/', id, '/image')
          ELSE image_url
        END AS imageUrl,
        featured,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM projects
    `;

    const params = [publicApiUrl];

    if (req.query.category && req.query.category !== "All") {
      sql += " WHERE category = ?";
      params.push(clean(req.query.category, 60));
    }

    sql += " ORDER BY featured DESC, created_at DESC LIMIT 60";

    const [projects] = await pool.execute(sql, params);

    for (const project of projects) {
      const [images] = await pool.execute(
        "SELECT image_url FROM project_images WHERE project_id = ? ORDER BY id",
        [project.id]
      );

      project.gallery = images.map(image => image.image_url);
    }

    res.json({ projects });

  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// CUSTOMER ENQUIRY SUBMISSION
// --------------------------------------------------

app.post("/api/enquiries", async (req, res, next) => {
  try {
    const name = clean(req.body.name, 100);
    const phone = clean(req.body.phone, 20);
    const email = clean(req.body.email, 254).toLowerCase();
    const projectType = clean(req.body.projectType, 60);
    const location = clean(req.body.location, 160);
    const budget = clean(req.body.budget, 80);
    const message = clean(req.body.message, 2000);

    if (
      name.length < 2 ||
      !/^[+()0-9\s-]{8,20}$/.test(phone) ||
      !enquiryTypes.includes(projectType) ||
      location.length < 2 ||
      message.length < 10
    ) {
      return res.status(400).json({
        message: "Please check the required fields and try again."
      });
    }

    if (email && !validator.isEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO enquiries
       (name, phone, email, project_type, location, budget, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        phone,
        email || null,
        projectType,
        location,
        budget || null,
        message
      ]
    );

    const enquiry = {
      id: result.insertId,
      name,
      phone,
      email,
      projectType,
      location,
      budget,
      message
    };

    try {
      await sendEnquiryEmail(enquiry);
      console.log("Enquiry notification email sent successfully!");
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    res.status(201).json({
      message: "Thank you! Your enquiry has been received.",
      id: result.insertId
    });

  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// ONE-TIME ADMIN SETUP
// --------------------------------------------------

app.post("/api/auth/setup", async (req, res, next) => {
  try {
    if (
      !process.env.SETUP_KEY ||
      req.body.setupKey !== process.env.SETUP_KEY
    ) {
      return res.status(403).json({
        message: "Setup is disabled."
      });
    }

    const [admins] = await pool.execute(
      "SELECT COUNT(*) AS total FROM admins"
    );

    if (admins[0].total > 0) {
      return res.status(409).json({
        message: "An admin already exists."
      });
    }

    const name = clean(
      req.body.name || process.env.ADMIN_NAME,
      100
    );

    const email = clean(
      req.body.email || process.env.ADMIN_EMAIL,
      254
    ).toLowerCase();

    const password = String(
      req.body.password || process.env.ADMIN_PASSWORD || ""
    );

    if (
      !name ||
      !validator.isEmail(email) ||
      password.length < 12
    ) {
      return res.status(400).json({
        message:
          "Use a name, valid email and password of at least 12 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.execute(
      "INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash]
    );

    res.status(201).json({
      message: "Admin created successfully."
    });

  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8
  }),
  async (req, res, next) => {
    try {
      const email = clean(req.body.email, 254).toLowerCase();
      const password = String(req.body.password || "");

      const [rows] = await pool.execute(
        "SELECT id, name, email, password_hash FROM admins WHERE email = ? LIMIT 1",
        [email]
      );

      const admin = rows[0];

      if (
        !admin ||
        !(await bcrypt.compare(password, admin.password_hash))
      ) {
        return res.status(401).json({
          message: "Email or password is incorrect."
        });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
      }

      const token = jwt.sign(
        {
          sub: String(admin.id),
          email: admin.email,
          name: admin.name
        },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRES_IN || "8h"
        }
      );

      res.json({
        token,
        admin: {
          name: admin.name,
          email: admin.email
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// GET ALL ENQUIRIES FOR ADMIN
// --------------------------------------------------

app.get("/api/admin/enquiries", requireAdmin, async (req, res, next) => {
  try {
    const [enquiries] = await pool.execute(
      `SELECT
        id,
        name,
        phone,
        email,
        project_type AS projectType,
        location,
        budget,
        message,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM enquiries
       ORDER BY created_at DESC
       LIMIT 500`
    );

    res.json({ enquiries });

  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// UPDATE ENQUIRY STATUS
// --------------------------------------------------

app.patch(
  "/api/admin/enquiries/:id",
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const status = req.body.status;

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "Invalid record identifier."
        });
      }

      if (!enquiryStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid status."
        });
      }

      const [result] = await pool.execute(
        "UPDATE enquiries SET status = ? WHERE id = ?",
        [status, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Enquiry not found."
        });
      }

      const [rows] = await pool.execute(
        `SELECT
          id,
          name,
          phone,
          email,
          project_type AS projectType,
          location,
          budget,
          message,
          status,
          created_at AS createdAt,
          updated_at AS updatedAt
         FROM enquiries
         WHERE id = ?`,
        [id]
      );

      res.json({ enquiry: rows[0] });

    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// ADD PROJECT WITH IMAGE UPLOAD
// --------------------------------------------------

app.post(
  "/api/admin/projects",
  requireAdmin,
  upload.single("image"),
  async (req, res, next) => {
    let connection;
    let transactionStarted = false;

    try {
      const title = clean(req.body.title, 120);
      const category = clean(req.body.category, 60);
      const location = clean(req.body.location, 120);
      const description = clean(req.body.description, 1200);

      if (!title || !category || !location || !description || !req.file) {
        return res.status(400).json({
          message:
            "Complete all required fields and select a project image."
        });
      }

      if (!projectCategories.includes(category)) {
        return res.status(400).json({
          message: "Invalid project category."
        });
      }

      // Gallery images remain URL-based.
      let gallery = [];

      if (req.body.gallery) {
        try {
          const parsedGallery =
            typeof req.body.gallery === "string"
              ? JSON.parse(req.body.gallery)
              : req.body.gallery;

          if (Array.isArray(parsedGallery)) {
            gallery = parsedGallery.filter(safeUrl).slice(0, 12);
          }
        } catch {
          return res.status(400).json({
            message: "Gallery data must be a valid JSON array."
          });
        }
      }

      connection = await pool.getConnection();

      await connection.beginTransaction();
      transactionStarted = true;

      const [result] = await connection.execute(
        `INSERT INTO projects
          (
            title,
            category,
            location,
            description,
            image_url,
            image_data,
            image_mime_type,
            image_name,
            featured
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          category,
          location,
          description,
          "",
          req.file.buffer,
          req.file.mimetype,
          clean(req.file.originalname, 255),
          ["true", "1", "yes"].includes(
            String(req.body.featured).toLowerCase()
          )
        ]
      );

      const projectId = result.insertId;

      for (const image of gallery) {
        await connection.execute(
          "INSERT INTO project_images (project_id, image_url) VALUES (?, ?)",
          [projectId, image]
        );
      }

      await connection.commit();
      transactionStarted = false;

      const project = await getProject(projectId);

      res.status(201).json({ project });

    } catch (error) {
      if (connection && transactionStarted) {
        await connection.rollback();
      }

      next(error);

    } finally {
      if (connection) connection.release();
    }
  }
);

// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

app.delete(
  "/api/admin/projects/:id",
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "Invalid record identifier."
        });
      }

      const [result] = await pool.execute(
        "DELETE FROM projects WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Project not found."
        });
      }

      res.json({
        message: "Project deleted."
      });

    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image size must be 5 MB or smaller."
      });
    }

    return res.status(400).json({
      message: "There was a problem with the uploaded image."
    });
  }

  if (
    error.message === "Only JPG, PNG and WebP images are allowed."
  ) {
    return res.status(400).json({
      message: error.message
    });
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({
      message: "Related record was not found."
    });
  }

  if (
    error.code === "ER_DATA_TOO_LONG" ||
    error.code === "ER_TRUNCATED_WRONG_VALUE"
  ) {
    return res.status(400).json({
      message: "Some submitted information is invalid."
    });
  }

  res.status(500).json({
    message: "Something went wrong. Please try again later."
  });
});

// --------------------------------------------------
// START SERVER AFTER CHECKING MYSQL CONNECTION
// --------------------------------------------------

async function startServer() {
  try {
    await pool.query("SELECT 1");

    console.log("MySQL connected successfully!");

    app.listen(port, () => {
      console.log(`RK Construction API listening on port ${port}`);
    });

  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
