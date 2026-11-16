# HushTalk frontend

React + Vite + Tailwind CSS + JavaScript frontend, organized into pages, components, context, hooks, and services.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173.

Set `VITE_API_BASE_URL` and `VITE_WS_URL` in `.env.local` if your backend uses a different host or port. Restart Vite after changing environment variables.

## Features

- Register and automatically sign in after successful registration.
- Login and logout.
- Conversation list and creation.
- Add another registered user to a conversation.
- Load message history.
- STOMP connection authenticated with the access token.
- Subscribe to `/topic/conversations/{conversationId}`.
- Send messages to `/app/conversations/{conversationId}/messages`.

## Backend contract used

- `POST /api/v1/users` with `{ username, email, password }`
- `POST /api/v1/auth/login` with `{ email, password }`
- `POST /api/v1/auth/logout` with `{ refreshToken }`
- `GET /api/v1/users`
- `GET /api/v1/conversations`
- `POST /api/v1/conversations` with `{ name }`
- `POST /api/v1/conversations/{id}/members` with `{ userId }`
- `GET /api/v1/conversations/{id}/messages/cursor?limit=50`
- STOMP endpoint `/ws`
- STOMP SEND `/app/conversations/{id}/messages`
- STOMP SUBSCRIBE `/topic/conversations/{id}`

## Email verification

This UI does not ask for a verification code. The backend must also stop requiring email verification. See `backend-changes/UserService.java` and `backend-changes/AuthService.java` in this package for the exact changes to apply.

## Development/security notes

- This starter stores access and refresh tokens in localStorage for development convenience. Choose a stronger production token-storage strategy before deployment.
- The current backend's `GET /api/v1/users` exposes all users and their email addresses. It is used here only to populate the add-member selector. Replace it with a restricted user-search endpoint before production.
- Conversation creation currently creates a conversation with its owner only; this UI adds the selected member in a second API request.
- The UI decodes the `userId` JWT claim only to identify the current user's message bubbles. The backend remains responsible for authorization.
- Refresh-token renewal, typing indicators, read receipts, attachments, and calls are not included yet.
