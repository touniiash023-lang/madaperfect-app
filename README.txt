MADAPERFECT - Complete package (Option B)

Included files:
- App.js (main application)  -- integrated with Firebase Auth and role checks (superadmin/commercial)
- Login.js
- firebase.js (template) -> replace config
- index.js, index.css
- tailwind.config.js, postcss.config.js
- package.json
- firestore.rules
- README (this file)

Important steps to make it work:
1) In Firebase Console -> Authentication -> Enable Email/Password and create two users:
   - superadmin@example.com
   - commercial@example.com

2) Use Firebase Admin SDK to set custom claims:
   Example Node script:
   const admin = require('firebase-admin');
   admin.initializeApp({ credential: admin.credential.applicationDefault() });
   const email = process.argv[2];
   const role = process.argv[3]; // 'superadmin' or 'commercial'
   (async () => {
     const user = await admin.auth().getUserByEmail(email);
     await admin.auth().setCustomUserClaims(user.uid, { role });
     console.log('Claim set', email, role);
   })();

   Run:
   node setCustomClaims.js superadmin@example.com superadmin
   node setCustomClaims.js commercial@example.com commercial

3) Update firebase.js with your project credentials (API key, projectId, ...).

4) Deploy to Netlify (build command: npm run build, publish: 'build').

Notes:
- Client-side role checks are applied but security must be enforced by Firestore rules (included).
- After deployment, test login with both accounts.
