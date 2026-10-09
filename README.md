# WintArc

Daily goals, streaks and friends for a 90-day winter arc. Split the arc into
tracks (Web Dev, DSA, Badminton), give each one a weekly schedule and a few
goals, and check them off every day it runs.

- `client/` is a React + Vite + Tailwind single-page app.
- `server/` is an Express API on Prisma and Postgres.
- Supabase provides the database and sign-in (email and Google).

## Running it locally

You need Node 22 or newer and a Supabase project.

```sh
npm install
cp server/.env.example server/.env   # then fill it in
cp client/.env.example client/.env   # then fill it in
npm run db:push                      # creates the tables
npm run dev                          # client on :5173, API on :4000
```

## Checks

```sh
npm run build   # generates the Prisma client, typechecks, bundles the client
npm run lint
npm test
```

CI runs the same three on every push and pull request.

## Deploying

The server hands out the built client in production, so the whole app is one
Node process on one origin:

```sh
npm ci
npm run build
npm start        # listens on $PORT, default 4000
```

Set the variables from `server/.env.example` in the host's environment. The
client's two `VITE_` variables are read at build time, so they have to be set
before `npm run build`. In Supabase, add the deployed URL under
Authentication -> URL Configuration so sign-in redirects back to it.

`GET /api/health` answers 200 once the database is reachable, for the host's
health check.

After changing `server/prisma/schema.prisma`, run `npm run db:push` against the
production database before deploying the code that needs it.
