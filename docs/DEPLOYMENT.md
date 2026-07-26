# Production deployment

## MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user limited to the application database.
3. Configure an IP access list for the backend host and keep TLS enabled.
4. Put the `mongodb+srv://` URI in Render as `MONGODB_URI`; never expose it to Vercel.

## Cloudinary private resume storage

1. Create a Cloudinary product environment.
2. Add its cloud name, API key, and API secret to Render.
3. Set `STORAGE_PROVIDER=cloudinary`.
4. PDFs are uploaded as authenticated raw assets under `ai-interview-copilot/resumes`.
5. Preview requires JWT ownership and returns a five-minute signed URL.
6. Resume deletion also destroys its private cloud asset.

Never use `VITE_` for Cloudinary secrets.

## Backend on Render

1. Connect the repository and apply the root [render.yaml](../render.yaml) Blueprint.
2. Supply every variable marked `sync: false`.
3. Set `CLIENT_URL` to the final HTTPS Vercel origin. Separate multiple origins with commas.
4. Deploy and verify `https://<service>.onrender.com/health`.
5. Confirm `status=ok`, `database=connected`, and `version=1.0.0`.

The Blueprint runs `npm ci`, starts `node server.js`, trusts one proxy hop, and monitors `/health`.

## Frontend on Vercel

1. Import the repository with framework preset `Vite`.
2. Set `VITE_API_URL=https://<render-service>.onrender.com/api`.
3. Deploy. [vercel.json](../vercel.json) preserves React Router deep links and caches fingerprinted assets.
4. Copy the final Vercel origin into Render's `CLIENT_URL` and redeploy the API.

## Seed and verify

Set `DEMO_EMAIL`, `DEMO_NAME`, and a strong `DEMO_PASSWORD`, then run `npm run seed:demo` from `server`. Remove `DEMO_PASSWORD` from the host after seeding if it is no longer required.

Before release, exercise authentication, owned CRUD, AI generation/evaluation, cloud PDF preview/deletion, analytics, exports, coach streaming, challenge claims, CORS rejection, error states, and mobile light/dark layouts. Confirm no credentials or raw prompts appear in responses or logs.

## Rollback

Keep the previous Vercel and Render deployments available. Version 1.0 database changes are additive, so roll back application code without deleting Atlas documents or Cloudinary assets.
