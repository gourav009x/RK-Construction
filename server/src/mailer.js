
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.MAIL_PORT || 465),
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendEnquiryEmail(enquiry) {
  const mailOptions = {
    from: `"RK Construction Website" <${process.env.MAIL_USER}>`,
    to: process.env.ENQUIRY_TO_EMAIL,
    replyTo: enquiry.email || undefined,
    subject: `New Project Enquiry - ${enquiry.projectType}`,
    text: `
NEW CUSTOMER ENQUIRY

Name: ${enquiry.name}
Phone: ${enquiry.phone}
Email: ${enquiry.email || "Not provided"}

Project Type: ${enquiry.projectType}
Location: ${enquiry.location}
Budget: ${enquiry.budget || "Not specified"}

Project Details:
${enquiry.message}

Received from RK Construction Website.
    `,
  };

  return transporter.sendMail(mailOptions);
}
