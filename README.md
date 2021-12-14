# Cloudflare + Lit Protocol integration (API)
This is an API for Cloudflare + Lit Protocol integration. 
Please note that this is just a demo project. It might have security issues and concurrency read/write problems.

## To run this project 
Create .wrangler.toml file (see .wrangler.toml.example)
```
npm i @cloudflare/wrangler -g
npm ci
npm run dev
```

## To deploy this project
Deploy to alpha environment
```
npm run publish:alpha
```
