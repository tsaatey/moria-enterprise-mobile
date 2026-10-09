@AGENTS.md

# Moria Enterprise Mobile

Mobile client for Moria Enterprise: an offline-first POS for salespeople, plus owner admin on mobile.

## Sources of truth (authoritative)

These are authoritative. When this repo disagrees with them, they win. Check them before you design or build a feature.

- **Backend / API:** `../moria-enterprise-backend`
  - `specification.md` is the contract, especially § Offline Sync Protocol, § Authentication and § API Conventions. `docs/*.yaml` holds the OpenAPI shapes (shared schemas are in `docs/_components.yaml`). Read `OPEN-ITEMS.md` before starting a feature.
  - Endpoints, request and response shapes, auth, roles and permissions, validation rules (`validations/*.js`) and domain logic all come from here. Don't invent or guess API contracts.
- **Mobile UI/UX design:** `../moria-enterprise-backend/prototypes/mobile/index.html`
  - Screens, navigation (tabs and side menu), flows, roles (Owner and Salesperson), copy and visual design all come from here. Build what the prototype shows. Each screen is a `render<Name>()` function there.
  - Theme tokens are in `../moria-enterprise-backend/prototypes/shared/theme.js`, mirrored in `src/theme/tokens.ts`. Assets are in `../moria-enterprise-backend/prototypes/assets`.

If the backend and the prototype conflict, or if either is missing something a feature needs, flag it to the user. Don't silently pick one or fill the gap with your own design.

## Architecture

Expo SDK 57, React Native, TypeScript, Expo Router. Routes are in `src/app/`; non-route code lives outside it.

| Path | Role |
| --- | --- |
| `src/app/_layout.tsx` | Fonts, `SQLiteProvider` (runs migrations), session bootstrap, and `<SessionGuard />`, which `router.replace`s to the screen the session status allows (`src/navigation/session-route.ts`). Don't switch back to root-level `Stack.Protected`: in this Expo Router version, guards toggled at runtime were never applied to the navigator. |
| `src/app/index.tsx` | Entry URL `/`: redirects via `sessionRoute()` |
| `src/app/(auth)/*` | login, pin (unlock), set-pin, change-password |
| `src/app/(app)/_layout.tsx` | Prototype shell: header (menu · logo · sync), 4 bottom tabs, side drawer. Owner-only screens sit behind `Tabs.Protected` |
| `src/api/` | `client.ts` (fetch, error envelope, refresh-and-retry on `TOKEN_EXPIRED`), typed endpoint modules, wire types |
| `src/auth/` | Session store (zustand), secure storage, device id, local PIN (native argon2id via react-native-quick-crypto) |
| `src/db/` | SQLite schema with append-only migrations (`PRAGMA user_version`) |
| `src/sync/` | Push/pull engine, sync status store, `useAutoSync` triggers |
| `src/pos/` | Cart store and the wholesale pricing rule |
| `src/db/*.ts` | Local reads and writes per area (catalog, customers, sales, debts, shops, sync issues) |
| `tests/` | Jest (`jest-expo`); `tests/helpers/memory-db.ts` runs the real SQL on better-sqlite3 |
| `src/lib/` | money (decimal.js), ids (device UUIDs), dates (Africa/Accra calendar dates) |
| `src/theme/tokens.ts` | Colours, type scale and fonts from the prototype theme |

## Rules

- **Offline first.** POS writes (sales, items, payments, customers, stock movements) go to SQLite first, with a device-generated UUID and `syncStatus = 'pending'`. They never wait on the network. The sync engine pushes them.
- **Sync contract.** Push order is customers → sales (with items and checkout payments) → standalone payments → stock movements. Push is always 200: rejections come back per record and stay on the device as `rejected` until corrected. Apply `customerRemaps`. Never push `sale` stock movements, and only the owner pushes movements at all. The pull cursor is the server's `serverTime`, never the device clock. Catalog rows are removed by `isActive = false` or by `deletedAt`.
- **Queued records belong to their user.** Every offline row records who made it (`sales.userId`, `payments.receivedBy`, `customers.createdBy`, `stockMovements.userId`). Only the signed-in user's rows are pushed, because the server attributes a record to the token's user. Another user's queue waits on the phone until they sign in again.
- **Wholesale.** Once one line reaches `wholesaleMinQuantity`, the whole line is charged the shop's wholesale price, applied on the device (`src/pos/pricing.ts`), and the line sends `priceTier`.
- **Phone numbers** go through `src/lib/phone.ts` (`normalizePhone`) before they are stored, compared or pushed. It mirrors the backend's `utils/phone.js` (libphonenumber-js, national form `0244000000`), so the local duplicate check and the server's merge by phone agree.
- **Debts** are never stored as a figure the device computes on its own. Balances come from the server's `debts` view (`GET /debts`, cached in `debtsCache` on every sync). The device only overlays its own unsynced credit sales and instalments on top (`getOpenDebts`), and marks those figures `provisional`.
- **Money** is a 2-dp string on the wire and TEXT in SQLite. Do arithmetic with `src/lib/money.ts` (decimal.js), never with JS floats.
- **Errors**: branch on `error.code`, not on HTTP status (`NOT_FOUND` and `CONFLICT` are 400).
- **Tokens**: the refresh token lives in SecureStore only, and the access token in memory only. All refreshes go through the single-flight `refreshSession()`, because the API revokes every token on the device when a refresh token is replayed. A network failure must never sign the user out.
- **Salesperson scope**: the server forces it from the JWT. The UI also hides owner-only screens. Don't send `shopId` as if it were trusted.
- Native modules (quick-crypto, SQLite, SecureStore) need a development build, not Expo Go.
- Run `npm run typecheck`, `npm run lint` and `npm test` before you call a task done.

## Deviations from the prototype (confirmed or awaiting confirmation)

- The login screen's demo-role buttons and "Or try PIN unlock flow" are prototype-only and are omitted. "Forgot?" tells the user to ask the owner, because the API has no self-service reset.
- Added screens that are not in the prototype: **set PIN** (spec § PIN Unlock), which reuses the PIN layout, and **change password** (for `mustChangePassword`), which reuses the login card.
- The PIN is a fixed 4 digits, as in the prototype. The API accepts 4–6.
- Icons use MaterialIcons rather than Material Symbols. `apparel` becomes `checkroom`.
- POS: the owner picks the selling shop first ("Selling at" chips), because prices and stock are per shop. A salesperson always sells from their own shop. The web console does the same.
- POS: the "Premium" badge is not shown, because the API has no field for it.
- Process Payment: order lines get +/− quantity steppers and wholesale pricing with a hint under the line. A credit sale takes an optional deposit (cash or MoMo), which the API accepts as a payment no larger than the total. The customer section adds search and an inline "New Customer" form (the prototype's Add Customer fields), because the spec asks for customer capture at checkout. Picking an existing customer for credit fills in a missing name and address.
- Customers & Debts: added search and an **Overdue** chip beside All/Debtors. **Take Payment** is per credit sale: when a customer has more than one open sale, the sheet asks which one, overdue and oldest first, and "Full" settles that sale. The API takes an instalment against one sale and refuses over-payment. Cards for customers without a name and address offer "Add name & address for credit", which works offline and fills blanks only. "Last purchase" is shown only when this device knows of a sale. A "Needs attention" panel lists records the server refused, with **Complete** (for `CUSTOMER_INCOMPLETE`) or **Retry**. The hero card shows when the balances were last fetched.
