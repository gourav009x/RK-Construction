import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import multer from "multer";
import mongoose from "mongoose";

import { connectDB } from "./db.js";
import { Project, Enquiry, Admin } from "./models.js";
import { requireAdmin } from "./middleware.js";
import { sendEnquiryEmail } from "./mailer.js";

const app = express();

// Trust Render's reverse proxy to identify visitor IP addresses
app.set("trust proxy", 1);

const port = Number(process.env.PORT || 5000);

const getPublicApiUrl = req => {
  if (
    process.env.API_PUBLIC_URL &&
    !process.env.API_PUBLIC_URL.includes("YOUR-BACKEND-NAME") &&
    !process.env.API_PUBLIC_URL.includes("your-backend-app")
  ) {
    return process.env.API_PUBLIC_URL.replace(/\/$/, "");
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${protocol}://${host}/api`;
};

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map(o => o.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
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
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Only JPG, PNG and WebP images are allowed."));
    }

    callback(null, true);
  }
});

// --------------------------------------------------
// RATE LIMITING
// --------------------------------------------------


// GLOBAL API RATE LIMIT
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message: "Too many requests. Please try again later."
    }
  })
);

// CUSTOMER ENQUIRY RATE LIMIT
app.use(
  "/api/enquiries",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message: "Too many enquiries. Please try again after 15 minutes."
    }
  })
);


// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const clean = (value, max = 2000) => String(value ?? "").trim().slice(0, max);

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
  "New Building Construction",
  "RCC and Concrete Work",
  "MS Structure Fabrication and Erection",
  "Industrial Sheds and Steel Structures",
  "Structural Steel Framework",
  "Civil Construction Work",
  "Building Renovation and Structural Repair",
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

function formatProject(p, baseUrl) {
  const hasImageData = Boolean(p.imageData && p.imageData.length);
  return {
    id: p._id.toString(),
    _id: p._id,
    title: p.title,
    category: p.category,
    location: p.location,
    description: p.description,
    imageUrl: hasImageData ? `${baseUrl}/projects/${p._id}/image` : p.imageUrl || "",
    gallery: p.gallery || [],
    featured: Boolean(p.featured),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RK Construction API",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// --------------------------------------------------
// SERVE PROJECT IMAGE FROM MONGODB
// --------------------------------------------------

app.get("/api/projects/:id/image", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid project ID."
      });
    }

    const project = await Project.findById(id).select("imageData imageMimeType");

    if (!project || !project.imageData) {
      return res.status(404).json({
        message: "Image not found."
      });
    }

    res.setHeader("Content-Type", project.imageMimeType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.send(project.imageData);
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// GET ALL PROJECTS
// --------------------------------------------------

app.get("/api/projects", async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.category && req.query.category !== "All") {
      filter.category = clean(req.query.category, 60);
    }

    const projectsRaw = await Project.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .limit(60);

    const baseUrl = getPublicApiUrl(req);
    const projects = projectsRaw.map(p => formatProject(p, baseUrl));

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

    const enquiry = await Enquiry.create({
      name,
      phone,
      email: email || undefined,
      projectType,
      location,
      budget: budget || undefined,
      message
    });

    // Send email notification asynchronously without blocking client response
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
      sendEnquiryEmail({
        id: enquiry._id,
        name,
        phone,
        email,
        projectType,
        location,
        budget,
        message
      })
        .then(() => console.log("Enquiry notification email sent successfully!"))
        .catch(emailError => console.error("Email sending notice:", emailError.message));
    }

    res.status(201).json({
      message: "Thank you! Your enquiry has been received.",
      id: enquiry._id
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
    if (!process.env.SETUP_KEY || req.body.setupKey !== process.env.SETUP_KEY) {
      return res.status(403).json({
        message: "Setup is disabled."
      });
    }

    const count = await Admin.countDocuments();
    if (count > 0) {
      return res.status(409).json({
        message: "An admin already exists."
      });
    }

    const name = clean(req.body.name || process.env.ADMIN_NAME, 100);
    const email = clean(req.body.email || process.env.ADMIN_EMAIL, 254).toLowerCase();
    const password = String(req.body.password || process.env.ADMIN_PASSWORD || "");

    if (!name || !validator.isEmail(email) || password.length < 12) {
      return res.status(400).json({
        message: "Use a name, valid email and password of at least 12 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Admin.create({
      name,
      email,
      passwordHash
    });

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

      const admin = await Admin.findOne({ email });

      if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
        return res.status(401).json({
          message: "Email or password is incorrect."
        });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
      }

      const token = jwt.sign(
        {
          sub: String(admin._id),
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

app.get("/api/admin/enquiries", requireAdmin, async (_req, res, next) => {
  try {
    const rawEnquiries = await Enquiry.find()
      .sort({ createdAt: -1 })
      .limit(500);

    const enquiries = rawEnquiries.map(e => ({
      id: e._id.toString(),
      _id: e._id,
      name: e.name,
      phone: e.phone,
      email: e.email,
      projectType: e.projectType,
      location: e.location,
      budget: e.budget,
      message: e.message,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt
    }));

    res.json({ enquiries });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// UPDATE ENQUIRY STATUS
// --------------------------------------------------

app.patch("/api/admin/enquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid record identifier."
      });
    }

    if (!enquiryStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status."
      });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found."
      });
    }

    res.json({
      enquiry: {
        id: enquiry._id.toString(),
        _id: enquiry._id,
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email,
        projectType: enquiry.projectType,
        location: enquiry.location,
        budget: enquiry.budget,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        updatedAt: enquiry.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// ADD PROJECT WITH IMAGE UPLOAD
// --------------------------------------------------

app.post(
  "/api/admin/projects",
  requireAdmin,
  upload.single("image"),
  async (req, res, next) => {
    try {
      const title = clean(req.body.title, 120);
      const category = clean(req.body.category, 60);
      const location = clean(req.body.location, 120);
      const description = clean(req.body.description, 1200);

      if (!title || !category || !location || !description || !req.file) {
        return res.status(400).json({
          message: "Complete all required fields and select a project image."
        });
      }

      if (!projectCategories.includes(category)) {
        return res.status(400).json({
          message: "Invalid project category."
        });
      }

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

      const project = await Project.create({
        title,
        category,
        location,
        description,
        imageData: req.file.buffer,
        imageMimeType: req.file.mimetype,
        imageName: clean(req.file.originalname, 255),
        imageUrl: "",
        gallery,
        featured: ["true", "1", "yes"].includes(String(req.body.featured).toLowerCase())
      });

      const baseUrl = getPublicApiUrl(req);
      res.status(201).json({ project: formatProject(project, baseUrl) });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// DELETE PROJECT
// --------------------------------------------------

app.delete("/api/admin/projects/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid record identifier."
      });
    }

    const result = await Project.findByIdAndDelete(id);

    if (!result) {
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
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((error, _req, res, _next) => {
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

  if (error.message === "Only JPG, PNG and WebP images are allowed.") {
    return res.status(400).json({
      message: error.message
    });
  }
  if (error.name === "ValidationError") {
    console.error("ENQUIRY VALIDATION ERROR:", error);
  
    return res.status(400).json({
      message: "Some submitted information is invalid.",
      details: Object.values(error.errors).map((err) => ({
        field: err.path,
        reason: err.message,
        value: err.value
      }))
    });
  }
  if (error.name === "CastError") {
    return res.status(400).json({
      message: "Invalid record identifier."
    });
  }

  res.status(500).json({
    message: "Something went wrong. Please try again later."
  });
});

// --------------------------------------------------
// START SERVER AFTER CONNECTING TO MONGODB
// --------------------------------------------------

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`RK Construction API listening on port ${port}`);
    });
  })
  .catch(error => {
    console.error("Server startup error:", error.message);
  });

export default app;
