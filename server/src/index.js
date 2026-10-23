import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import { Admin, Enquiry, Project } from "./models.js";
import { requireAdmin } from "./middleware.js";

const app = express();
const port = process.env.PORT || 5000;
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",").map(s => s.trim()) || "http://localhost:5173" }));
app.use(express.json({ limit: "150kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/enquiries", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }));

const clean = (value, max = 2000) => String(value ?? "").trim().slice(0, max);
const safeUrl = (value) => {
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol); } catch { return false; }
};

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "RK Construction API" }));

app.get("/api/projects", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== "All") filter.category = clean(req.query.category, 60);
    const projects = await Project.find(filter).sort({ featured: -1, createdAt: -1 }).limit(60).lean();
    res.json({ projects });
  } catch (e) { next(e); }
});

app.post("/api/enquiries", async (req, res, next) => {
  try {
    const name = clean(req.body.name, 100);
    const phone = clean(req.body.phone, 20);
    const email = clean(req.body.email, 254);
    const projectType = clean(req.body.projectType, 60);
    const location = clean(req.body.location, 160);
    const budget = clean(req.body.budget, 80);
    const message = clean(req.body.message, 2000);
    const allowed = ["New Construction", "Renovation", "Civil Work", "Commercial", "Other"];
    if (name.length < 2 || !/^[+()0-9\s-]{8,20}$/.test(phone) || !allowed.includes(projectType) || location.length < 2 || message.length < 10) {
      return res.status(400).json({ message: "Please check the required fields and try again." });
    }
    if (email && !validator.isEmail(email)) return res.status(400).json({ message: "Please enter a valid email address." });
    const enquiry = await Enquiry.create({ name, phone, email, projectType, location, budget, message });
    res.status(201).json({ message: "Thank you. Your enquiry has been received.", id: enquiry._id });
  } catch (e) { next(e); }
});

// One-time admin setup. Requires SETUP_KEY and refuses if an admin already exists.
// After first use, remove this endpoint and SETUP_KEY before public production launch.
app.post("/api/auth/setup", async (req, res, next) => {
  try {
    if (!process.env.SETUP_KEY || req.body.setupKey !== process.env.SETUP_KEY) return res.status(403).json({ message: "Setup is disabled." });
    if (await Admin.countDocuments()) return res.status(409).json({ message: "An admin already exists." });
    const name = clean(req.body.name || process.env.ADMIN_NAME, 100);
    const email = clean(req.body.email || process.env.ADMIN_EMAIL, 254).toLowerCase();
    const password = String(req.body.password || process.env.ADMIN_PASSWORD || "");
    if (!validator.isEmail(email) || password.length < 12) return res.status(400).json({ message: "Use a valid email and password of at least 12 characters." });
    const passwordHash = await bcrypt.hash(password, 12);
    await Admin.create({ name, email, passwordHash });
    res.status(201).json({ message: "Admin created. Remove the setup key and disable this endpoint." });
  } catch (e) { next(e); }
});

app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8 }), async (req, res, next) => {
  try {
    const email = clean(req.body.email, 254).toLowerCase();
    const password = String(req.body.password || "");
    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
    const token = jwt.sign({ sub: admin._id.toString(), email: admin.email, name: admin.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
    res.json({ token, admin: { name: admin.name, email: admin.email } });
  } catch (e) { next(e); }
});

app.get("/api/admin/enquiries", requireAdmin, async (_req, res, next) => {
  try { res.json({ enquiries: await Enquiry.find().sort({ createdAt: -1 }).limit(500).lean() }); }
  catch (e) { next(e); }
});
app.patch("/api/admin/enquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const statuses = ["New", "Contacted", "Site Visit", "Quoted", "Won", "Closed"];
    if (!statuses.includes(req.body.status)) return res.status(400).json({ message: "Invalid status." });
    const item = await Enquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Enquiry not found." });
    res.json({ enquiry: item });
  } catch (e) { next(e); }
});
app.post("/api/admin/projects", requireAdmin, async (req, res, next) => {
  try {
    const { title, category, location, description, imageUrl } = req.body;
    if (![title, category, location, description, imageUrl].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ message: "Complete all required project fields." });
    if (!safeUrl(imageUrl)) return res.status(400).json({ message: "Image URL must be HTTP or HTTPS." });
    const gallery = Array.isArray(req.body.gallery) ? req.body.gallery.filter(safeUrl).slice(0, 12) : [];
    const project = await Project.create({ title: clean(title, 120), category, location: clean(location, 120), description: clean(description, 1200), imageUrl: clean(imageUrl, 1000), gallery, featured: Boolean(req.body.featured) });
    res.status(201).json({ project });
  } catch (e) { next(e); }
});
app.delete("/api/admin/projects/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await Project.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "Project not found." });
    res.json({ message: "Project deleted." });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ message: "Some submitted information is invalid." });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid record identifier." });
  res.status(500).json({ message: "Something went wrong. Please try again later." });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, () => console.log(`RK Construction API listening on ${port}`)))
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
