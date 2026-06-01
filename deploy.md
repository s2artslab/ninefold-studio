# Deploy Ninefold Studio AI Lab to Cloudflare Pages

Production URL: **https://ninefold-studio.s2artslab.com**

Hub **AI Lab** links and `egregore-lab` deep links should resolve here.

## One-time setup

1. Create Cloudflare Pages project **`ninefold-studio`** (direct upload or connect `s2artslab/ninefold-studio` on GitHub).
2. Add custom domain **`ninefold-studio.s2artslab.com`** in Pages → Custom domains.
3. DNS (proxied CNAME):
   - `ninefold-studio` → `ninefold-studio.pages.dev`

## Deploy

```powershell
cd C:\Users\shast\S2\APPs\ninefold-studio
.\scripts\deploy-pages.ps1
```

Requires `CLOUDFLARE_API_TOKEN` with **Account → Cloudflare Pages → Edit** (or global Pages deploy permission).

Alternative:

```powershell
npm run deploy:cloudflare
```

## Local preview

```powershell
npm run dev
```

Open http://localhost:3000
