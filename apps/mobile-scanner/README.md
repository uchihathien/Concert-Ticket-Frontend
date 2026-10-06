# NexaTicket Mobile Scanner

Expo app for staff check-in. Staff sign in with Keycloak, choose an active or upcoming session from an organization where they have `CHECKIN_SCAN`, then scan the ticket QR with the device camera.

The app sends the QR token to the existing `scanTicket` SDK endpoint. The server validates the ticket, payment state, session and staff permissions; the QR is never decoded locally.

## Local development

1. Set the current host LAN address in `.env.local` from `.env.example`.
2. Ensure Keycloak has the `mobile-scanner` public PKCE client and the Expo redirect URI listed in the realm configuration.
3. Run the catalog, ticketing, and API gateway services with the same `OIDC_ISSUER` used by Keycloak.
4. From `frontend/`, run `pnpm install` if dependencies have not been installed.
5. Run `pnpm --filter @nexaticket/mobile-scanner start` and open the QR in Expo Go.

The scanner uses port 8083 so the customer app can keep its Metro server on 8082.