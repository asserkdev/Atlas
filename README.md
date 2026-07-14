# Atlas v0.1

Atlas is a knowledge and project workspace — the place where you store, organize, connect, and manage everything you know and create.

Built with:
- React + TypeScript + Vite
- Supabase (Auth + PostgreSQL)
- TipTap (rich text editor)
- Cambric Design System

## Live Demo

**Live URL:** https://asserkdev.github.io/Atlas/

## Features

- **Notes**: Create, edit, and organize notes with rich text formatting
- **Projects**: Group related notes into projects
- **Folders**: Organize notes and projects into folders (one level deep)
- **Search**: Fast client-side search across all notes
- **Autosave**: Notes save automatically as you type
- **Responsive**: Works on desktop and mobile browsers
- **Row Level Security**: All data is protected - users can only access their own data

## Quick Start

### 1. Set up Supabase (if using your own instance)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy:
   - **Project URL**
   - **anon/public** key
3. In the Supabase dashboard, go to **SQL Editor** and run the schema from `supabase/schema.sql`

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### 4. Deploy

The app is automatically deployed to GitHub Pages on every push to main.

#### Manual Deployment

**GitHub Pages:**
1. Build the project: `npm run build`
2. Deploy the `dist` folder to GitHub Pages

**Vercel (Recommended for production):**
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`

Required environment variables in Vercel:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

## Data Model

- **Notes**: title, rich text content (HTML), timestamps
- **Projects**: name, description, contains notes
- **Folders**: name, optional parent folder (one level nesting)

## Security

All data is protected by Supabase Row Level Security (RLS). Users can only access their own data. The RLS policies ensure proper data isolation from day one.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth)
- **Rich Text**: TipTap editor
- **Styling**: Custom CSS with Cambric Design System tokens
- **Hosting**: GitHub Pages (current) / Vercel (recommended)

## License

Proprietary — Cambric