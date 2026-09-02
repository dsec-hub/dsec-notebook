# DSEC Notebook

![Svelte](https://img.shields.io/badge/sveltekit-%23f1413d.svg?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

[Live site](https://notebook.dsec.club/)

A centralised resource hub for Deakin University students studying **SIT** (IT, computer science, and cybersecurity) and **Mathematics** units. Students can share study notes, ask questions, and browse content organised by unit and topic.

> Written by students, for students. This project is not affiliated with Deakin University.

## Features

- 📚 **Notes** — post study notes in Markdown, organised by unit and topic.
- ❓ **Questions & answers** — ask questions, post answers, and mark questions as solved.
- 💬 **Comments** — discuss notes directly.
- 👍 **Voting** — upvote or downvote notes and questions.
- 🔍 **Search** — find notes by title or content.
- 🎓 **Deakin-only accounts** — only `@deakin.edu.au` email addresses can contribute. Create an account with a password after verifying your email, then sign in with email and password.
- 🛠️ **Admin dashboard** — manage units, accounts, and notes, plus weekly posting statistics. The first person to open the dashboard verifies their email to become the admin.
- 🗂️ **Units & topics** — browse content by Deakin unit code (e.g. `SIT102`, `SIT192`) or topic (e.g. Algorithms, Mathematics).
- 💾 **Persistent storage** — all data is stored in a local SQLite database.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) with [Svelte 5](https://svelte.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [adapter-node](https://svelte.dev/docs/kit/adapters) for the Node.js server
- Node's built-in `node:sqlite` for persistence
- [Vitest](https://vitest.dev/) for unit and browser tests

## Requirements

- [Node.js](https://nodejs.org/) 24 or newer (Node 22+ may work, but the project is developed and containerised against Node 24)
- npm

## Getting started

1. Clone the repository and install dependencies:

    ```sh
    npm install
    ```

2. Configure environment variables:

    ```sh
    cp .env .env.local
    ```

    `DATABASE_PATH` defaults to `data/dsec.db`. To send verification emails, set
    `RESEND_API_KEY` (get one at <https://resend.com/api-keys>). Without it, email
    verification will fail.

3. Start the development server:

    ```sh
    npm run dev
    ```

4. Open the URL printed in the terminal (usually `http://localhost:5173`).

## Environment variables

| Variable         | Description                             | Default                                 |
| ---------------- | --------------------------------------- | --------------------------------------- |
| `DATABASE_PATH`  | Path to the SQLite database file        | `data/dsec.db`                          |
| `RESEND_API_KEY` | Resend API key for verification emails  | _(required)_                            |
| `RESEND_FROM`    | "From" address for verification emails  | `DSEC Notebook <onboarding@resend.dev>` |
| `HOST`           | Host the Node server binds to (build)   | `0.0.0.0`                               |
| `PORT`           | Port the Node server listens on (build) | `3000`                                  |

## Scripts

| Script              | Description                                 |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start the Vite/SvelteKit development server |
| `npm run build`     | Build a production bundle                   |
| `npm run preview`   | Preview the production build locally        |
| `npm run check`     | Run `svelte-check` type checking            |
| `npm test`          | Run unit and browser tests once             |
| `npm run test:unit` | Run tests in watch mode                     |

## Running with Docker

A `Dockerfile` and `docker-compose.yml` are included. The app runs on port `3000` inside the container and is mapped to host port `4073`.

```sh
docker compose up --build
```

Then open `http://localhost:4073`.

The SQLite database is persisted in the `dsec-data` Docker volume. To change the exposed port, edit `docker-compose.yml`.

## Project structure

```
src/
├── lib/
│   ├── components/     # Reusable UI components (Navbar, FeedRow, VoteStack)
│   ├── server/         # Server-side API and SQLite database logic
│   ├── stores/         # Svelte stores (auth state)
│   ├── api.ts          # Client-side API helper
│   ├── types.ts        # Shared TypeScript types
│   └── time.ts         # Relative time formatting
├── routes/
│   ├── +page.svelte    # Home page
│   ├── +layout.svelte  # App layout and nav
│   ├── notes/          # Notes feed and note detail pages
│   ├── questions/      # Questions feed and question detail pages
│   ├── post/           # Create note / question forms
│   ├── topics/[slug]/  # Topic pages
│   ├── units/[code]/   # Unit pages
│   ├── search/         # Search page
│   ├── auth/login/     # Sign in page
│   ├── admin/          # Admin dashboard
│   └── api/+server.ts  # JSON API endpoint
└── app.html
```

## How it works

- The frontend calls a single JSON API endpoint (`POST /api`) with a function name and arguments.
- The server dispatches those calls to handlers in `src/lib/server/api.ts`, backed by SQLite.
- On first run, the database is created automatically and seeded with common Deakin SIT/Math units and CS/maths topics.
- Authentication is email-verified: to create an account you sign in with a `@deakin.edu.au` address, a 6-digit code is sent via Resend, and after entering the code you set a password. Once created, you sign in with just your email and password. A "forgot password" flow sends a reset code to your Deakin address so you can set a new password. Passwords are stored as salted scrypt hashes, and sessions are stored as tokens in `localStorage`.

## Data model

The SQLite database contains the following tables:

- `users` — Deakin email accounts (each has a `role`: `user` or `admin`)
- `units` — Deakin unit codes and names
- `topics` — CS and maths topics
- `notes` — shared study notes
- `questions` — student questions
- `comments` — note comments and question answers
- `votes` — upvotes/downvotes on notes and questions
- `email_verifications` — pending email verification codes

## Disclaimer

DSEC Notebook is a community resource for Deakin University students. It is not affiliated with, endorsed by, or officially connected to Deakin University.
