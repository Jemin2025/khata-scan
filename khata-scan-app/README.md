# Khata Scan — Backend + App

Yeh ek complete package hai: **Node.js + Express + SQLite backend** aur wahi Khata Scan app
(Home dashboard, invoice, khata, cheque, bills, orders) frontend mein. Ab data browser mein nahi,
apne server ke **real database** mein save hota hai, aur login/password se protect hota hai.

## Kya hai isme

```
khata-scan-app/
  server.js          -> Express server (API + app dono serve karta hai)
  db.js              -> SQLite database setup (users + storage tables)
  middleware/auth.js -> Login check karne wala code (JWT)
  routes/auth.js      -> /api/auth/register, /api/auth/login, /api/auth/me
  routes/storage.js   -> /api/storage/*  (data save/load — bills, orders, invoices, sab kuch)
  public/index.html   -> Poora app (dashboard + saare tabs) — isi ko backend serve karta hai
  data/               -> SQLite database file yahin banegi (khata.db)
  .env.example        -> Config template
```

## Chalane ka tareeka (local computer pe test karne ke liye)

1. [Node.js](https://nodejs.org) install karo (version 18 ya usse upar).
2. Terminal mein is folder ke andar jao aur:
   ```
   npm install
   ```
3. `.env.example` ko copy karke `.env` banao, aur `JWT_SECRET` ki jagah ek lambi random string daalo:
   ```
   cp .env.example .env
   ```
   (Random string banane ke liye: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
4. Server start karo:
   ```
   npm start
   ```
5. Browser mein kholo: **http://localhost:3000**
6. Pehli baar "Naya account banao" par click karke apna username/password banao — bas, app use karna shuru karo.

Data ab `data/khata.db` file mein save hota hai (SQLite database). Yeh file jitni der server chalu
rahega, wahi persist rahegi.

## Apni website / server pe host karna (production)

Kisi bhi Node.js hosting pe deploy kar sakte ho — kuch options:

- **Render.com** ya **Railway.app** — GitHub repo connect karo, "Node" app select karo, `npm start`
  as start command, aur environment variable mein `JWT_SECRET` daalo (aur agar chaho to `SIGNUP_KEY`
  bhi taaki koi bhi random insaan account na bana sake).
- **Apna VPS (DigitalOcean, Hostinger VPS, etc.)** — Node install karo, is folder ko upload karo,
  `npm install --production`, phir `npm start` (ya PM2 se background mein chalao: `pm2 start server.js`).
  Nginx ko reverse-proxy laga do apne domain se port 3000 tak.

Zaroori: production mein hamesha `.env` file mein apna **JWT_SECRET** set karo — default wala sirf
local testing ke liye hai aur secure nahi hai.

### Agar frontend aur backend alag jagah host karna hai

Agar `public/index.html` ko kisi aur jagah (jaise Netlify/Vercel) host karna hai aur backend kahin
aur, to `public/index.html` ke andar `API_BASE` wali line dhoondo (auth/storage shim script ke top
mein) aur wahan apne backend ka pura URL daal do, jaise:
```js
const API_BASE = 'https://api.aapkidukaan.com';
```
Warna default (khaali string) same-origin maan kar chalta hai, jo tab sahi hai jab backend hi
frontend serve kar raha ho (jaisa yeh setup default mein karta hai).

## Login system kaise kaam karta hai

- Har user apna username/password banata hai (`/api/auth/register`).
- Login karne par ek token milta hai jo browser mein save hota hai aur har request ke saath jata hai.
- Har user ka data **alag-alag** save hota hai (dusre ka data nahi dikhega) — agar ek hi dukaan ke
  liye multiple log-in chahiye (jaise malik + munim), sabko apna-apna account banana hoga.
- Agar chahte ho ki sirf tumhe pata ho signup kaise karna hai (public par koi random account na
  banaye), to `.env` mein `SIGNUP_KEY` set karo — phir bina us key ke naya account nahi banega.

## Purane data ko yahan laana (agar pehle Claude mein app use kar rahe the)

Purane wale mein data browser/artifact storage mein tha. Agar wahan se yahan laana hai, mujhe
bolo — us data ko yahan ke database mein daalne ka chhota script bana dunga.
