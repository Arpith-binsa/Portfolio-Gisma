/*
  Firebase settings for the shot list.

  Is it safe that these are visible? Yes. A Firebase web config (including apiKey) is an
  identifier, not a password: every visitor's browser has to receive it for the app to work,
  and GitHub Pages has no server where "environment variables" could hide it.
  Security comes from three things instead (see README.md):
    1. database.rules.json  – who may read/write, what shape data must have, rate limits
    2. API (Application Programming Interface) key restrictions in Google Cloud – only
       your domain may use this key
    3. Optional App Check – blocks scripts and bots that aren't your page

  Never put real secrets here (service-account keys, admin tokens, passwords).
  To rotate the key: create a new one in Google Cloud Console, paste it below, push,
  then delete the old one.
*/
window.BWF_CONFIG = Object.freeze({
  firebase: Object.freeze({
    apiKey: "AIzaSyDHd_w6KOCNzQGwQdLHs3978lTw0i9wg1Y",
    authDomain: "bwf-photo-tracker.firebaseapp.com",
    databaseURL: "https://bwf-photo-tracker-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bwf-photo-tracker",
    appId: "1:152289017345:web:5c8118d2ac7bfd4747ca00"
  }),

  // Optional: reCAPTCHA v3 site key for App Check (Step 8 in README.md). Leave empty to skip.
  appCheckSiteKey: ""
});
