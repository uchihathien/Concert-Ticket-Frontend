# NexaTicket Mobile Customer

Native iOS and Android customer app built with Expo Router. It lives beside `web-customer` and
uses the same API gateway and shared TypeScript SDK.

Requires Node 22.13 or newer (Expo SDK 57).

## Run

From `frontend/`:

```bash
pnpm install
cp apps/mobile-customer/.env.example apps/mobile-customer/.env.local
pnpm --filter @nexaticket/mobile-customer start
```

Press `i` for an iOS simulator, `a` for an Android emulator, or scan the QR code with Expo Go.
Default `localhost` URLs work in the iOS simulator. For an Android emulator, use
`http://10.0.2.2:8080` for the API and `http://10.0.2.2:8081/realms/nexaticket` for Keycloak.
For a physical device, set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_KEYCLOAK_ISSUER` in
`.env.local` to the computer's LAN IP, for example `http://192.168.1.20:8080` and
`http://192.168.1.20:8081/realms/nexaticket`; `localhost` on a phone points to the phone itself.

## Current scope

- Explore events, search, category filters, and event details use the public catalog API.
- Native OIDC uses the dedicated public `mobile-customer` Keycloak client with PKCE S256.
- Refresh tokens are stored with SecureStore; access tokens remain in memory.
- The ticket wallet loads signed tickets and renders their QR tokens only when opened.
- Booking selects quantities by zone (matching the current web flow), places idempotent holds and
  orders, and opens the hosted payOS checkout. Seat availability refreshes using ETags every 5s.
- The web app's Auth.js session is server-side and is not reused as a native mobile session.

Development/production builds use the `nexaticket://auth` callback. Expo Go uses a LAN callback
such as `exp://192.168.1.20:8082/--/auth`; add that exact URI to the Keycloak client's valid
redirect URIs and set `EXPO_PUBLIC_OIDC_REDIRECT_URI` to the same value. The development realm
configuration contains the current workstation callback; a running Keycloak realm must still be
updated through the admin console or reimported. On a physical device, use the development
machine's LAN IP for API, Keycloak, and Expo Go callback URLs.