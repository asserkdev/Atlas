# Atlas v0.1

Atlas is your personal daily workspace — the place where you store, organize, and manage everything you know and do.

Built with:
- React + TypeScript + Vite
- Supabase (Auth + PostgreSQL)
- TipTap (rich text editor)
- Cambric Design System

## Live Demo

**Live URL:** https://asserkdev.github.io/Atlas/

## Features

### Daily Use Tools
- **Tasks** — Full task management with priorities, due dates, and completion tracking
- **Bookmarks** — Save links for later with auto-fetch titles and personal notes
- **Notes** — Rich text notes with templates for meetings, daily journals, and task lists

### Organization
- **Projects**: Group related notes into projects
- **Folders**: Organize notes and projects into folders (one level deep)
- **Tags**: Color-coded tags for flexible categorization
- **Starred**: Quick access to important items

### Productivity
- **Quick Search** (⌘/Ctrl+K): Search across all notes instantly
- **Templates**: Pre-built templates for common note types
- **Word Count**: See reading time and word count in the editor
- **Export**: Download notes as Markdown files
- **Autosave**: Everything saves automatically as you type

### Security & Privacy
- **Row Level Security**: All data is protected — users can only access their own data
- **Responsive**: Works on desktop and mobile browsers

## Quick Start

### 1. Set up Supabase (if using your own instance)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy:
   - **Project URL**
   - **anon/public** key
3. In the Supabase dashboard, go to **SQL Editor** and run:
   - First run `supabase/schema.sql` (main schema)
   - Then run `supabase/migrations/002_add_tasks_and_bookmarks.sql` (if you want Tasks & Bookmarks)

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

- **Notes**: title, rich text content (HTML), starred, word count, timestamps
- **Projects**: name, description, contains notes
- **Folders**: name, optional parent folder (one level nesting)
- **Tasks**: title, description, due date, priority (low/medium/high), completed status
- **Bookmarks**: URL, title, description, favicon, archived status
- **Tags**: name, color (for notes)

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