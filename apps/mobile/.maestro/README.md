Run mobile end-to-end flows with Maestro against the dev Android app:

```bash
npm run dev:mobile
npm run android:dev
npm run test:mobile:e2e
```

Single flows:

```bash
npm --workspace apps/mobile run test:e2e:guest
npm --workspace apps/mobile run test:e2e:booking
npm --workspace apps/mobile run test:e2e:host
```

Notes:
- These flows are dev-only and use the `carparking://e2e?...` deep link to seed test data.
- The app id is `ie.freespace.app.dev`.
- A connected Android device or emulator is required.
