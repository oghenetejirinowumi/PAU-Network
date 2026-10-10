# PAU-Network

PAU Network bridges the gap between Pan-Atlantic University students and alumni. Filter mentors by course, view profiles, and seamlessly book career guidance sessions. Built during a 6-hour hackathon.

## LinkedIn sign-in

Create an app in the [LinkedIn Developer Portal](https://www.linkedin.com/developers/) and enable **Sign In with LinkedIn using OpenID Connect**. Add this exact authorized redirect URL to the app:

```text
http://localhost:4000/api/v1/auth/linkedin/callback
```

Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `backend/.env`. The default callback URL and frontend URL are for local development; set `LINKEDIN_REDIRECT_URI`, `FRONTEND_URL`, and `CORS_ORIGINS` for your deployment. The app requests only the `openid`, `profile`, and `email` scopes. Existing accounts are signed in by their verified LinkedIn email; new users confirm their PAU role, department, and study or employment details during registration.

Apply the new LinkedIn identity column before running the updated backend with `cd backend && npm run db:deploy`.

## Space audio rooms

Spaces use LiveKit Cloud for real-time audio. Create a LiveKit Cloud project and set `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in `backend/.env` (the URL starts with `wss://`). Restart the backend after configuration. The backend issues short-lived room tokens only to participants who have joined a live space; hosts and promoted speakers may publish microphone audio, while listeners may only subscribe. Tokens do not permit video or data publishing. No Jitsi account or moderator login is required.

## Space reminder emails

Users who click **Remind me** are emailed once 1 hour before and again 15 minutes before a scheduled space starts. Configure `RESEND_API_KEY` and `EMAIL_FROM` in `backend/.env`; the sender address must be verified in Resend. Apply pending migrations with `cd backend && npm run db:deploy` and restart the backend. Reminder emails link to the space in the frontend. If the backend is unavailable during a reminder window, pending emails are sent when it resumes, while the space is still scheduled to start.
