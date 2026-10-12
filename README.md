# CampusFix

CampusFix is a campus complaint management and tracking portal. Students can report campus maintenance issues and follow their progress. Administrators review and verify reports, then assign them to department authorities. Authorities manage assigned work and update its status.

## Live application

[Open CampusFix](https://campus-fix-tau.vercel.app/login)

## Features

- Separate student, administrator, and department authority workspaces
- Complaint submission with optional photo or video attachment
- Complaint review, verification, assignment, and status tracking
- Department routing and priority management
- AI-assisted complaint categorization and similar-issue matching when the related services are configured
- Private complaint media storage backed by Supabase Storage
- Role- and ownership-based access enforced with Supabase authentication and row-level security

## Tech stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Supabase Auth, Postgres, and Storage
- Tailwind CSS 4
- Gemini and Hugging Face inference integrations for optional AI features

## Run locally

### Requirements

- Node.js (use a current LTS release)
- npm
- A Supabase project configured with the CampusFix database schema and migrations

### Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the repository root and set the Supabase values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

   `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted by the app for the public key. Use the publishable key for new setups. Never expose a service role key in a `NEXT_PUBLIC_` variable.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public Supabase key used by the app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Alternative | Legacy public key name; used when the publishable key is not set |
| `SUPABASE_SERVICE_ROLE_KEY` | For privileged server operations | Server-only key used for trusted database operations; never expose it to the browser |
| `GEMINI_API_KEY` | Optional | Enables Gemini-based complaint analysis and categorization |
| `GEMINI_MODEL` | Optional | Gemini model override; defaults to `gemini-2.5-flash` |
| `HUGGINGFACE_API_TOKEN` | Optional | Enables complaint embeddings for similarity matching |
| `HUGGINGFACE_FEATURE_EXTRACTION_URL` | Optional | Overrides the Hugging Face feature extraction endpoint |
| `COMPLAINT_SIMILARITY_THRESHOLD` | Optional | Similarity threshold for same-category matching |
| `COMPLAINT_CROSS_CATEGORY_SIMILARITY_THRESHOLD` | Optional | Similarity threshold for cross-category matching |

Add any server-side secrets to `.env.local` for local development and to the deployment platform's server environment settings for production. Do not commit secret values.

## Database setup

The SQL files in [`supabase/migrations`](supabase/migrations) add or update CampusFix database functionality, including role and department scoping, complaint workflows, similarity matching, and private attachment storage. They assume the base CampusFix `public.issues` and `public.profiles` schema and Supabase Auth/Storage are already present.

Review and apply the migrations to your Supabase project using the Supabase SQL Editor or your established migration workflow. Check each migration's preflight requirements and comments before applying it; the complaint media migration specifically expects the existing issue/profile tables and role-scope helper functions. The optional AI similarity features also require their corresponding database migrations and server credentials.

## Available commands

```bash
npm run dev    # Start the local development server
npm run build  # Build the production application
npm run start  # Serve the production build locally
npm run lint   # Run ESLint
```

## Deployment

The live app is hosted at [campus-fix-tau.vercel.app](https://campus-fix-tau.vercel.app/login). For another deployment, connect the repository to Vercel (or another Next.js-compatible host), configure the environment variables above, and ensure the target Supabase project has the required schema, functions, policies, and storage bucket configured.
