# Atlas v0.1

Atlas is a knowledge and project workspace — the place where you store, organize, connect, and manage everything you know and create.

Built with:
- React + TypeScript + Vite
- Supabase (Auth + PostgreSQL)
- TipTap (rich text editor)
- Cambric Design System

## Getting Started

### 1. Set up Supabase

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

The app is designed to deploy to any static hosting service:

```bash
npm run build
```

For Vercel:
```bash
npx vercel
```

## Features

- **Notes**: Create, edit, and organize notes with rich text formatting
- **Projects**: Group related notes into projects
- **Folders**: Organize notes and projects into folders
- **Search**: Fast client-side search across all notes
- **Autosave**: Notes save automatically as you type
- **Responsive**: Works on desktop and mobile browsers

## Data Model

- **Notes**: title, rich text content, timestamps
- **Projects**: name, description, contains notes
- **Folders**: name, optional parent folder (one level nesting)

## Security

All data is protected by Supabase Row Level Security (RLS). Users can only access their own data.

## License

Proprietary — Cambric