# moria-enterprise-mobile

React Native (Expo) app for **Moria Enterprise**. It is an offline-first POS for salespeople and also gives the owner admin on mobile. It talks only to [`moria-enterprise-backend`](../moria-enterprise-backend). See its `specification.md` for the contract, and `prototypes/mobile/index.html` for the design.

## Getting started

Requires Node 20+ and npm 11. Run the backend locally first (`npm run dev` there; it serves on `:4800`).

```bash
npm install
cp .env.example .env     # set EXPO_PUBLIC_API_URL
npm start                # then press i / a, or scan with a dev build
```

The app uses native modules (SQLite, SecureStore, quick-crypto's argon2), so it needs a development build (`npx expo run:ios`, `npx expo run:android`, or `eas build --profile development`). Expo Go will not run it.

On a physical device, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP. On the Android emulator, use `http://10.0.2.2:4800`.

## Scripts

| Command | |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run ios` / `npm run android` | Start and open on a simulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (eslint-config-expo) |
| `npm test` | Jest — pricing, money, schema, offline queue and sync engine |
| `npm run doctor` | expo-doctor |

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for the layout and the rules the offline queue depends on.
