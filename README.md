# Code Nova

Code Nova is a Next.js 16 application with:

- NextAuth authentication (GitHub + Google)
- Prisma + MongoDB
- AI chat endpoint powered by a local Ollama server
- Playground and dashboard modules

## 1. Prerequisites

Install these first:

- Node.js 20+ (LTS recommended)
- npm 10+
- MongoDB database (local or Atlas)
- Ollama (optional, only required for local AI chat)

## 2. Clone and install

```bash
git clone <your-repo-url>
cd code-nova
npm install
```

## 3. Environment variables

Create `.env.local` in the project root and add:

```env
# Prisma
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority"

# NextAuth
AUTH_SECRET="<a-long-random-secret>"

# OAuth providers
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Local AI (Ollama)
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="codellama:7b"
OLLAMA_TIMEOUT_MS="0"
OLLAMA_NUM_PREDICT="220"
```

Notes:

- `DATABASE_URL` is required.
- `AUTH_SECRET` is required.
- OAuth credentials are required for GitHub/Google login flows.
- Ollama variables are optional unless you want to use the chat API locally.

## 4. Prepare database

Generate the Prisma client and sync schema to MongoDB:

```bash
npx prisma generate
npx prisma db push
```

## 5. Run the app

Start development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## 6. Run local AI chat (optional)

If you want `/api/chat` to work locally, start Ollama and pull a model:

```bash
ollama serve
ollama pull codellama:7b
```

If you use a different model, set `OLLAMA_MODEL` in `.env.local`.

## 7. Production build

```bash
npm run build
npm run start
```

## Available scripts

- `npm run dev` - start dev server
- `npm run build` - build for production
- `npm run start` - run production build
- `npm run lint` - run ESLint
- `npm run fix:playground-dates` - run date fix script
