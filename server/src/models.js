import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, enum: ["New Construction", "Renovation", "Civil Work", "Commercial", "Residential"] },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  imageUrl: { type: String, required: true, trim: true },
  gallery: [{ type: String, trim: true }],
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const enquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  projectType: { type: String, required: true, enum: ["New Construction", "Renovation", "Civil Work", "Commercial", "Other"] },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  budget: { type: String, trim: true, maxlength: 80 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ["New", "Contacted", "Site Visit", "Quoted", "Won", "Closed"], default: "New" },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

export const Project = mongoose.model("Project", projectSchema);
export const Enquiry = mongoose.model("Enquiry", enquirySchema);
export const Admin = mongoose.model("Admin", adminSchema);
