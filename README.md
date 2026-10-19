# KURAX-FOOD-LOUNGE-AND-BISTRO
A modern web platform for Kurax Food Lounge &amp; Bistro, designed to scale into menu management, reservations, staff roles, and content management.

## Shisha Department

The Shisha workspace is available at `/shisha` and uses its own staff accounts, packages, orders, status history, payment requests, and payment records. Its packages are internal-only and are not part of the public menu API or restaurant cashier workflow. Shisha tables are created automatically when the backend starts.

An authorized Director can sign in to the staff dashboard, open **Shisha Sales**, then use **HOD access** to create the first Shisha HOD. The HOD creates Shisha Waiter and Shisha Chef/Mixer accounts from the **Team** tab. Staff then sign in at `/shisha` with their Shisha email and PIN.

For an environment-provisioned initial HOD, set these backend variables before startup:

```env
JWT_SECRET=<long random secret shared by backend instances>
SHISHA_ADMIN_NAME=Shisha HOD
SHISHA_ADMIN_EMAIL=hod@example.com
SHISHA_ADMIN_PIN=<4-8 digit PIN>
```

`SHISHA_ADMIN_EMAIL` and `SHISHA_ADMIN_PIN` are optional when a Director creates the initial account in the app. Set a stable `JWT_SECRET` in deployed environments so staff sessions remain valid across backend restarts and instances.

Shisha PINs remain salted-hash authenticated and are additionally encrypted with AES-256-GCM so the HOD can retrieve waiter and mixer PINs from the Team tab. Set `SHISHA_PIN_ENCRYPTION_KEY` in `KURAX-BACKEND/.env` (or the repository root `.env`) to a randomly generated 32-byte (64 hexadecimal character) key before creating accounts or resetting PINs. The backend loads either location regardless of its startup working directory:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep this key secret, back it up securely, and use the same key on every backend instance. If the key is lost or changed, stored PINs cannot be retrieved, although sign-in continues to work; existing accounts need a PIN reset to make their PIN retrievable with the new key. Existing accounts created before this feature also need a PIN reset once the key is configured.

Shisha staff PINs are emailed using the backend's Gmail mailer. Add these to `KURAX-BACKEND/.env` and restart the backend to enable delivery:

```env
EMAIL_USER=your-sending-address@gmail.com
EMAIL_PASS=<Google app password>
FRONTEND_URL=http://localhost:5173
```

For Gmail, `EMAIL_PASS` must be an App Password for the sending account, not its normal sign-in password. Use your deployed frontend URL for `FRONTEND_URL` in production. HODs can retrieve or reset waiter and mixer PINs from the Team tab.

## Menu Image Storage

Menu images are saved by the backend in `KURAX-BACKEND/uploads/` and served from `/uploads/`. The backend creates the directory when an image is uploaded. For deployments that replace containers or use ephemeral filesystems, mount persistent storage at this directory so uploaded images remain available after redeployments.

The frontend's `VITE_API_URL` must be reachable by the browser. Docker deployments can leave it blank because Nginx proxies same-origin `/api` requests to the backend. For Vercel, set `VITE_API_URL` in the Vercel build environment to the publicly reachable HTTPS backend origin; do not use a private `10.x` address.

## Internal Staff Push Notifications

Staff push notifications use the existing React/Vite staff application, Express API, PostgreSQL, and Firebase Cloud Messaging. They are limited to restaurant and Shisha staff; no customer devices or customer-order events are registered.

1. Create a Firebase project and register a Web App. Enable Firebase Cloud Messaging and generate a Web Push certificate key pair. Use the Web App config and public VAPID key in `KURAX-FRONTEND/.env` (start with `.env.example`). The Vite variables are public web-app settings, not service-account credentials.
2. Configure `FIREBASE_PROJECT_ID` and either `FIREBASE_SERVICE_ACCOUNT_JSON` or Application Default Credentials in the backend environment. Keep the service-account private key only in the backend secret store. Use the same Firebase project on both sides.
3. Keep a stable `JWT_SECRET` configured for all backend instances. The backend creates the notification-device table during its normal schema initialization.
4. Rebuild/redeploy the frontend after setting its Firebase variables and restart/redeploy the backend after setting its credentials. Push permission requires HTTPS in production. On iPhone/iPad, install the site to the Home Screen and enable notifications from an authenticated staff page.

Each device registers its Firebase Installation ID and FCM delivery token against the authenticated restaurant or Shisha staff JWT. The Admin SDK sends to FCM tokens; installation IDs identify and deactivate the corresponding device. Department ticket events target their HOD/operator roles, ready events target the originating waiter, cashier requests target cashiers, and Shisha events target Shisha roles. Notification payloads contain internal route/reference metadata, not customer contact or payment details.

## Public Website Mobile Money Orders

Public menu-item and combo checkouts create a pending mobile money request in the cashier queue. The checkout displays Kurax MTN merchant code `678851` and Airtel merchant code `4320340`, along with the amount and order reference. A displayed code or customer-entered transaction ID does not confirm payment: an authenticated cashier must verify the payment, enter its transaction ID, and confirm it in the cashier dashboard. Only then is the order created for the restaurant workflow and its sale recorded. Pending and rejected requests remain clearly marked in the cashier queue; the checkout retains and refreshes the latest status for that cart.
