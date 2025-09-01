# BreakNeckAI 🚀

An **AI-powered SaaS platform** built with the **PERN stack (PostgreSQL, Express, React, Node.js)**.  
It provides content generation, image editing, and resume analysis with **free and premium subscription plans**.

🔗 Live Demo: [BreakNeckAI](https://break-neck-ai.vercel.app/)

---

## 🌟 Key Features

- 🔐 **User Authentication** – Secure sign-in, sign-up, and profile management with Clerk
- 💳 **Subscription Billing** – Premium subscriptions to unlock advanced AI features
- 🗄️ **Database** – Serverless PostgreSQL database powered by **Neon**

---

## 🤖 AI Features

- 📝 **Article Generator** – Generate articles by providing a title & length
- 📰 **Blog Title Generator** – Get catchy blog titles from keywords & categories
- 🎨 **Image Generator** – Create AI-generated images from text prompts
- 🖼️ **Background Remover** – Upload images and get transparent background versions
- ✂️ **Object Remover** – Remove unwanted objects from images by describing them
- 📄 **Resume Analyzer** – Upload resumes (PDF) and get detailed AI-driven feedback

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (via Neon)
- **Authentication & Billing:** Clerk
- **AI APIs:** OpenAI Gemini + ClipDrop
- **Media Handling:** Cloudinary

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js & npm
- Neon PostgreSQL database
- Clerk account (for auth & subscriptions)
- Cloudinary account (for media uploads)
- API keys (Gemini + ClipDrop)

### Environment Variables

Create a `.env` file in the project root with:

```env
GEMINI_API_KEY=your_gemini_api_key
CLIPDROP_API_KEY=your_clipdrop_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
DATABASE_URL=your_neon_postgres_connection_string
```
