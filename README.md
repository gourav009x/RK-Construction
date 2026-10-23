# RK Construction — MERN Website

Responsive lead-generation website for RK Construction, Karol Bagh, Delhi.
Stack: React + Vite + Tailwind-style custom CSS, Express, MongoDB/Mongoose, JWT admin authentication, Cloudinary-ready image fields.

## Features
- Responsive marketing website with hero, services, project gallery, about, contact and lead form
- WhatsApp and click-to-call CTAs
- Project gallery powered by API; safe fallback demo projects when API is unavailable
- Enquiry form saved to MongoDB
- Admin login, project CRUD, enquiry list and status updates
- Input validation, rate limiting, helmet, CORS, password hashing, JWT-protected admin routes
- SEO title/description, robots.txt and sitemap starter
- No fabricated reviews, project claims, contact number or credentials

## Requirements
- Node.js 20+
- MongoDB Atlas or local MongoDB
- Optional Cloudinary account for production image uploads (this starter accepts image URLs)

## 1. Configure environment
Copy `server/.env.example` to `server/.env` and fill in values:
- `MONGODB_URI`
- `JWT_SECRET` (long random secret)
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `CLIENT_ORIGIN`
- `WHATSAPP_NUMBER` (international digits only, e.g. 9198XXXXXXXX)
- `PHONE_NUMBER` (e.g. +91 98XXXXXXXX)

Copy `client/.env.example` to `client/.env` and set `VITE_API_URL=http://localhost:5000/api`.
Do not commit `.env` files.

## 2. Install and run
Terminal 1:
```bash
cd server
npm install
npm run dev
```
Terminal 2:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in the terminal. Admin page: `/admin`.

## 3. Create the first admin
With the server running, send:
```bash
curl -X POST http://localhost:5000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"name":"Site Admin","email":"admin@example.com","password":"replace-with-a-long-password","setupKey":"YOUR_SETUP_KEY"}'
```
Set `SETUP_KEY` in `server/.env` first. This endpoint only works when no admin exists. After creating the admin, remove `SETUP_KEY` and disable/remove the setup endpoint before public production use, or use it once and redeploy with setup disabled.

## 4. Add projects
Sign in at `/admin`. Add project title, category, location, description, image URL, and optional gallery image URLs. Use real, authorized project photographs. The demo cards are illustrative placeholders and should be replaced before launch.

## 5. Production deployment
### Backend (Render, Railway, or another Node host)
- Create a web service with root directory `server`
- Build command: `npm install`
- Start command: `npm start`
- Add all server environment variables in the host dashboard
- Set `CLIENT_ORIGIN` to your deployed frontend URL
- Configure MongoDB Atlas network access securely for the backend host

### Frontend (Vercel or Netlify)
- Import repository, root directory `client`
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL=https://YOUR-BACKEND-DOMAIN/api`
- Redeploy after setting variables

### Domain and SEO
- Connect your domain to Vercel/Netlify
- Add Google Search Console and submit `/sitemap.xml`
- Create/verify the Google Business Profile for the actual business
- Add the real phone, WhatsApp number, business hours, service area, genuine project photos and testimonials
- Update `client/public/sitemap.xml` to your production domain
- Add a privacy policy describing lead-form data use and retention

## Before launch checklist
- [ ] Replace placeholder phone/WhatsApp values
- [ ] Replace sample project images with real project photos
- [ ] Verify all service claims and areas served
- [ ] Change admin password and JWT secret
- [ ] Disable one-time setup endpoint after creating admin
- [ ] Confirm HTTPS, CORS, rate limits and MongoDB access
- [ ] Test enquiry form and admin status changes
- [ ] Add privacy policy and consent wording if appropriate
