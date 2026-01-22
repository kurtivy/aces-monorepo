# Base Mini App Authentication – Build Checklist Guide

This document explains **what the Authentication step in the Base Mini App build checklist is checking**, why it exists, and what you should verify in your app before considering it complete.

---

## 1. What “Authentication” Means in Base Mini Apps

Authentication in Base mini apps is **not traditional email/password auth**.

Instead, Base provides **Quick Auth**, a cryptographic sign‑in flow that:

- Confirms a user’s identity via wallet/Farcaster signature
- Issues a **JWT (JSON Web Token)**
- Allows your backend to **verify that the user is real and untampered**

This step ensures that:

- Users interacting with your app are legitimate
- Sensitive actions (on‑chain actions, user‑specific data) are secure
- Your backend does not trust spoofable frontend data

---

## 2. Why Authentication Is Required in the Checklist

The build checklist verifies that your mini app:

- Can securely identify users
- Can protect backend endpoints
- Is ready for real usage inside the Base ecosystem

If your app includes **any** of the following, authentication is required:

- Personalized user data
- On‑chain actions
- Saving user preferences or state
- Rate‑limited or gated features

---

## 3. Authentication vs Context (Important Distinction)

Base provides a **Context API** (`sdk.context`) that gives you:

- Username
- Display name
- Profile image
- Farcaster metadata

⚠️ **Context is NOT secure**

- It can be spoofed
- It should only be used for UI convenience
- It should NOT be trusted for backend logic

✅ **Quick Auth is required** for:

- Backend verification
- Secure identity
- Any critical or write action

---

## 4. The Quick Auth Flow (High Level)

```
User opens mini app
  ↓
Frontend requests auth token
  ↓
User signs (in‑app)
  ↓
JWT token returned
  ↓
Frontend sends token to backend
  ↓
Backend verifies token + domain
  ↓
User identity confirmed
```

---

## 5. What You Need on the Frontend

### Required Frontend Checks

Your frontend should:

- Call `sdk.quickAuth.getToken()`
- Receive a JWT token
- Send the token to your backend
- Handle signed‑in vs signed‑out states gracefully

### Example Frontend Logic

```ts
const { token } = await sdk.quickAuth.getToken();

await fetch('/api/auth', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

You do **not** need:

- Redirects
- Email/password forms
- External login pages

All auth happens **inside the Base mini app container**.

---

## 6. What You Need on the Backend

### Required Backend Checks

Your backend must:

- Accept a JWT from the frontend
- Verify the token cryptographically
- Verify the token was issued for **your domain**
- Extract the verified user identity

### Example Backend Logic

```js
import { createClient } from '@farcaster/quick-auth';

const client = createClient();

const payload = await client.verifyJwt({
  token,
  domain: 'your-app-domain.com'
});

const fid = payload.sub;
```

### What Verification Ensures

- The token was not modified
- The user signed the request
- The token belongs to your app
- The identity is trustworthy

---

## 7. What the Build Checklist Is Validating

When Base reviews your app, they are effectively checking:

### Frontend

- ✅ You use `sdk.quickAuth.getToken()`
- ✅ You do not rely solely on `sdk.context` for security
- ✅ Auth is in‑app (no external redirects)

### Backend

- ✅ JWTs are verified server‑side
- ✅ Domain validation is enforced
- ✅ Identity is not trusted from raw frontend input

---

## 8. Common Mistakes to Avoid

❌ Trusting `sdk.context` for authentication
❌ Skipping backend verification
❌ Storing user IDs without verifying tokens
❌ Using traditional auth flows (email/password)
❌ Redirecting users out of the mini app

---

## 9. When You Can Skip Authentication

You may skip Quick Auth **only if** your app:

- Is fully read‑only
- Has no personalization
- Has no backend state
- Has no on‑chain or gated actions

Otherwise, authentication is expected.

---

## 10. Final Checklist Summary

Before marking Authentication as complete, confirm:

- [ ] Frontend requests a Quick Auth token
- [ ] Token is sent to backend
- [ ] Backend verifies JWT
- [ ] Domain validation is enforced
- [ ] Identity is used safely

If all boxes are checked, your mini app meets the **Authentication requirement** of the Base build checklist.

---

**Status:** ✅ Ready for Base Mini App Review

