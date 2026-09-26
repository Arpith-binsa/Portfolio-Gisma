# Shot list · BWF I

Live at `https://www.arpithbinsa.com/photography/bwf-tracker/`

Works straight away on each phone (ticks saved on that phone). Follow the steps below once
to make your phone and the coach's phone share the same list.

## Files

| File | What it is |
|---|---|
| `index.html` | The page, with CSP (Content Security Policy) and SRI (Subresource Integrity) protections |
| `styles.css` | Design |
| `app.js` | App logic. No need to edit |
| `config.js` | Your Firebase settings. The only file you edit |
| `database.rules.json` | Security rules you paste into Firebase |
| `img/thumb`, `img/full` | Small and full-quality player photos |

## Setup

1. **Create the project.** console.firebase.google.com → Add project → name it `bwf-photo-tracker` → turn Google Analytics off → Create.
2. **Create the database.** Build → Realtime Database → Create database → location `europe-west1` → choose **Start in locked mode** (not test mode).
3. **Paste the rules.** Realtime Database → Rules tab → delete everything → paste the contents of `database.rules.json` → Publish.
4. **Accounts (username + password).** Authentication → Sign-in method → add **Email/Password** (leave "Email link" off) → Save. Turn **Anonymous** off. Then Users → Add user for each person, using `USERNAME@shotlist.arpithbinsa.com` as the email (for example `coach@shotlist.arpithbinsa.com`) and a password of 12+ characters. Copy each User UID (user ID). In Realtime Database → Data, add `bwf_tracker` → `allowed` → `<UID>: true` for each account. Only those accounts can read or tick.
5. **Register the web app.** Project overview → `</>` icon → nickname `Shot list` → leave Firebase Hosting unticked → Register. Copy the values from the `firebaseConfig` block into `config.js` (apiKey, authDomain, databaseURL, projectId, appId).
6. **Lock the key to your domain.** console.cloud.google.com → pick the same project → APIs & Services → Credentials → click "Browser key (auto created by Firebase)".
   - Application restrictions → Websites → add `https://www.arpithbinsa.com/*` and `https://arpithbinsa.com/*` (add `http://localhost/*` too if you test locally).
   - API restrictions → Restrict key → tick Identity Toolkit API, Token Service API (and Firebase App Check API if you do step 8) → Save.
7. **Publish.** Copy this folder to `photography/bwf-tracker/` in your repo, then:
   ```bash
   git add photography/bwf-tracker
   git commit -m "Add BWF shot list"
   git push origin main
   ```
   Open the page on both phones. The top right should say **Live with coach**.
8. **Optional, bot protection (App Check).** google.com/recaptcha/admin → create a reCAPTCHA v3 key for `arpithbinsa.com` → Firebase console → App Check → register the web app with that key → paste the **site key** into `appCheckSiteKey` in `config.js` → push → once the App Check dashboard shows verified requests, click Enforce for Realtime Database.

## What protects the data

- **Access list:** only accounts listed under `bwf_tracker/allowed` can read or write. Anyone else who signs up gets nothing. Remove a UID there to revoke access instantly.
- **Sign-in rate limit:** Firebase blocks repeated wrong passwords; the app also makes you wait 15 s after 3 failures, doubling each time.
- **Rules** (`database.rules.json`): only signed-in, listed accounts can read; only the 36 known player ids can be written; each entry must be exactly `{a: true/false, c: true/false, t: server time}` and anything else is rejected; entries can't be deleted.
- **Rate limits:** each phone can sync at most once per second (enforced by the rules per user id), each player can't be rewritten more than every 0.3 s, and the app itself allows bursts of 20 taps then one per second. A rejected write is kept on the phone and retried with back-off, and the user sees a short message instead of an error.
- **Key restrictions:** the API (Application Programming Interface) key only works from your domain.
- **No search indexing:** the page has `noindex`. Don't add it to `sitemap.xml`.

IP (Internet Protocol) address based limiting isn't possible in Firebase rules because they never see the visitor's IP. If you ever need it, put the site behind Cloudflare and add a rate-limiting rule there.

## Rotating the key

Google Cloud Console → Credentials → Create credentials → API key → apply the same restrictions as step 6 → paste it into `config.js` → push → delete the old key.

## Editing the roster

Player data is at the top of `app.js`. If you add or rename a player id, add it to the id list in `database.rules.json` too and publish the rules again.