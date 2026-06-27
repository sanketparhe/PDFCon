# PDFForge – Universal PDF Converter

A production-ready, full-stack PDF conversion web application built with Node.js, Express, and vanilla HTML/CSS/JS. Convert JPG, PNG, Word, and PowerPoint files to PDF. Merge and compress PDFs. All free, private, and instant.

---

## 📁 Project Structure

```
universal-pdf-converter/
├── frontend/                  # Static frontend (HTML/CSS/JS)
│   ├── index.html             # Homepage with hero, tools grid, stats
│   ├── css/
│   │   └── styles.css         # All styles: themes, components, responsive
│   ├── js/
│   │   ├── theme.js           # Dark/light mode toggle + localStorage
│   │   ├── main.js            # Homepage animations (counter, nav)
│   │   └── converter.js       # Upload, convert, history, preview logic
│   └── pages/
│       ├── tools.html         # Main converter dashboard
│       ├── about.html         # About page
│       ├── faq.html           # FAQ with accordion
│       └── contact.html       # Contact form
│
├── backend/                   # Node.js/Express API
│   ├── server.js              # Entry point: Express app, middleware, routes
│   ├── package.json           # Dependencies
│   ├── .env.example           # Environment variable template
│   ├── routes/
│   │   ├── convert.js         # POST /api/convert
│   │   └── download.js        # GET  /api/download/:filename
│   ├── controllers/
│   │   └── convertController.js  # All conversion logic
│   ├── middleware/
│   │   └── upload.js          # Multer config, file validation, sanitization
│   └── utils/
│       └── cleanup.js         # Auto-delete files older than 30 minutes
│
├── uploads/                   # Temporary file storage (gitignored)
│   └── .gitkeep
│
├── public/                    # Static SEO files
│   ├── sitemap.xml
│   └── robots.txt
│
└── .gitignore
```

---

## ⚙️ Installation

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 8 |
| LibreOffice | Latest stable (for Word/PPT conversion) |

### 1. Clone the Repository

```bash
git clone https://github.com/youruser/universal-pdf-converter.git
cd universal-pdf-converter
```

### 2. Install LibreOffice (Required for Word & PowerPoint)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y libreoffice
```

**macOS (Homebrew):**
```bash
brew install --cask libreoffice
```

**Windows:**
Download and install from https://www.libreoffice.org/download/download-libreoffice/

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env and set your ALLOWED_ORIGINS
```

### 5. Start the Backend

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be running at `http://localhost:3000`.

### 6. Serve the Frontend

Option A – Use VS Code Live Server (development):
- Open the `frontend/` folder in VS Code
- Right-click `index.html` → Open with Live Server

Option B – Serve with any static server:
```bash
npx serve frontend/ -p 5500
```

Option C – Nginx (production, see Deployment section)

### 7. Configure API URL

Open `frontend/js/converter.js` and update line 3:
```js
const API_BASE = 'https://your-api-domain.com/api';
```

---

## 🔌 API Reference

All endpoints are prefixed with `/api`.

---

### `GET /api/health`

Check that the server is running.

**Response:**
```json
{
  "status": "ok",
  "time": "2026-06-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

### `POST /api/convert`

Convert a file to PDF.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | File(s) | ✅ | 1–10 files depending on tool |
| `tool` | string | ✅ | See tool list below |

**Tool Values:**

| Tool | Accepted Files | Description |
|---|---|---|
| `jpg-to-pdf` | `.jpg`, `.jpeg` | Single image to PDF |
| `png-to-pdf` | `.png` | Single PNG to PDF |
| `word-to-pdf` | `.doc`, `.docx` | Word document to PDF |
| `ppt-to-pdf` | `.ppt`, `.pptx` | PowerPoint to PDF |
| `images-to-pdf` | `.jpg`, `.png`, `.webp` | Multiple images → 1 PDF |
| `merge-pdf` | `.pdf` | Multiple PDFs → 1 PDF |
| `compress-pdf` | `.pdf` | Reduce PDF file size |

**Response (200 OK):**
```json
{
  "success": true,
  "filename": "abc123.pdf",
  "originalName": "report.docx",
  "downloadUrl": "/api/download/abc123.pdf"
}
```

For `compress-pdf`, also includes:
```json
{ "saving": 34 }
```
(percentage reduction)

**Error Responses:**

| Status | Cause |
|---|---|
| 400 | Missing file, unsupported type, or unknown tool |
| 413 | File exceeds 50 MB limit |
| 500 | Conversion error (e.g., LibreOffice not installed) |

---

### `GET /api/download/:filename`

Download a converted PDF.

**Parameters:**

| Param | Description |
|---|---|
| `filename` | The `filename` returned by `/api/convert` |

**Response:**
- `200` – PDF file (Content-Disposition: attachment)
- `400` – Invalid or unsafe filename
- `404` – File not found (expired or invalid)

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| **Helmet.js** | Sets secure HTTP headers (X-Frame-Options, CSP, etc.) |
| **CORS** | Restrict API to allowed origins via `ALLOWED_ORIGINS` env var |
| **File size limit** | 50 MB enforced by Multer |
| **Extension whitelist** | Only `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx` |
| **Filename sanitization** | `sanitize-filename` strips dangerous characters |
| **Path traversal prevention** | Download route validates path stays inside `/uploads` |
| **Auto file deletion** | Files deleted 30 minutes after upload via `cleanup.js` |

---

## 🌍 Deployment

### Option 1: Render (Recommended for hobby/small scale)

1. Push your code to GitHub.
2. Create a new **Web Service** on [render.com](https://render.com).
3. Set:
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node server.js`
   - **Environment Variables:** `PORT=10000`, `ALLOWED_ORIGINS=https://yourdomain.com`
4. For the frontend, create a **Static Site** pointing to the `frontend/` folder.
5. Update `API_BASE` in `converter.js` to your Render backend URL.

**Note:** LibreOffice is NOT available on Render's free tier. For Word/PPT conversion, use Railway or a VPS.

---

### Option 2: Railway

Railway supports custom Docker images, enabling LibreOffice.

1. Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-slim

# Install LibreOffice
RUN apt-get update && apt-get install -y libreoffice && apt-get clean

WORKDIR /app
COPY backend/ ./backend/
COPY uploads/ ./uploads/

WORKDIR /app/backend
RUN npm install --production

EXPOSE 3000
CMD ["node", "server.js"]
```

2. Push to GitHub and connect to Railway.
3. Set environment variables in Railway dashboard.

---

### Option 3: Vercel (Frontend only)

Vercel hosts static sites. Deploy the `frontend/` folder:

```bash
npx vercel --prod frontend/
```

Then host the backend separately (Railway, Render, or VPS).

---

### Option 4: VPS (Ubuntu Server) – Full Control

**Step 1: Install dependencies**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm libreoffice nginx
sudo npm install -g pm2
```

**Step 2: Clone and set up**
```bash
git clone https://github.com/youruser/universal-pdf-converter.git /var/www/pdfforge
cd /var/www/pdfforge/backend
npm install --production
cp .env.example .env
nano .env  # fill in your settings
```

**Step 3: Start with PM2**
```bash
pm2 start server.js --name pdfforge-api
pm2 save
pm2 startup
```

**Step 4: Configure Nginx**

Create `/etc/nginx/sites-available/pdfforge`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend static files
    root /var/www/pdfforge/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy API to Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 55M;
    }

    # Larger body for uploads
    client_max_body_size 55M;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pdfforge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Step 5: SSL with Let's Encrypt**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🧪 Testing the API

```bash
# Health check
curl http://localhost:3000/api/health

# Convert JPG to PDF
curl -X POST http://localhost:3000/api/convert \
  -F "files=@/path/to/photo.jpg" \
  -F "tool=jpg-to-pdf"

# Merge two PDFs
curl -X POST http://localhost:3000/api/convert \
  -F "files=@/path/to/a.pdf" \
  -F "files=@/path/to/b.pdf" \
  -F "tool=merge-pdf"

# Download result
curl -O http://localhost:3000/api/download/abc123.pdf
```

---

## 📦 Key Libraries

| Library | Purpose | Docs |
|---|---|---|
| `express` | HTTP server and routing | https://expressjs.com |
| `multer` | Multipart file upload | https://github.com/expressjs/multer |
| `pdf-lib` | PDF creation and merging | https://pdf-lib.js.org |
| `libreoffice-convert` | Word/PPT to PDF via LibreOffice | https://github.com/elwerene/libreoffice-convert |
| `helmet` | Security HTTP headers | https://helmetjs.github.io |
| `cors` | Cross-origin request control | https://github.com/expressjs/cors |
| `sanitize-filename` | Prevent path traversal | https://github.com/parshap/node-sanitize-filename |
| `uuid` | Unique filenames | https://github.com/uuidjs/uuid |

---

## 🎨 Frontend Features

- **Dark mode** – persisted via localStorage, respects OS preference
- **Drag & drop** – works on desktop and mobile
- **File preview** – images previewed before conversion
- **Progress bar** – real-time upload and conversion feedback
- **Conversion history** – last 20 conversions stored in localStorage
- **Download counter** – tracks session downloads
- **Toast notifications** – success, error, info
- **Responsive** – Bootstrap 5 grid, works on all screen sizes
- **SEO ready** – meta tags, sitemap.xml, robots.txt

---

## ❓ Troubleshooting

**Word/PPT conversion fails:**
→ LibreOffice is not installed or not in PATH. Run `libreoffice --version` to verify.

**CORS errors in browser:**
→ Set `ALLOWED_ORIGINS` in `.env` to include your frontend URL exactly (no trailing slash).

**File too large error:**
→ Default limit is 50 MB. Increase `limits.fileSize` in `middleware/upload.js` and `client_max_body_size` in Nginx.

**Files not deleted:**
→ Cleanup runs every 5 minutes. Check server logs for `[Cleanup]` messages.

---

## 📄 License

MIT License. Free to use, modify, and distribute.
