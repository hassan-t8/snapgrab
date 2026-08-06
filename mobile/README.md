# SnapGrab — Flutter app

The native Android and iOS client for [SnapGrab](../README.md). Paste a link to download from 14 platforms, and convert, compress or resize images entirely on the device.

`Flutter 3.41` · `Dart 3.11` · `Material 3`

---

## Quick start

```bash
cd mobile
flutter pub get

# point it at your server — a LAN address works with `next dev`
flutter run --dart-define=SNAPGRAB_API=http://192.168.1.41:3001
```

Without `--dart-define` the app falls back to `http://192.168.1.41:3001`, the default in [`lib/core/config.dart`](lib/core/config.dart). For a real deployment:

```bash
flutter build apk --release   --dart-define=SNAPGRAB_API=https://your-domain.com
flutter build appbundle --release --dart-define=SNAPGRAB_API=https://your-domain.com
flutter build ipa --release   --dart-define=SNAPGRAB_API=https://your-domain.com
```

> The web server must be reachable from the phone. On a LAN, `next dev` needs your IP in `allowedDevOrigins` (already configured) and the app allows cleartext HTTP so local testing works; production traffic should be HTTPS.

---

## What is in the app

### Download tab
- **Clipboard detection** — the app checks the clipboard on launch and every time it returns to the foreground, so a link copied in YouTube or Instagram is picked up before you touch anything.
- **Live platform badge** as you type, from a local registry of all 14 platforms, so detection is instant and works offline.
- Results open in a draggable sheet grouped into **Video / Audio / Images**, with quality, container and file size on every row.
- Tapping a quality shows a **spinner on that row** immediately, so the tap visibly registers before the sheet closes.
- Downloads **stream to disk with live progress**, can be cancelled mid-flight, and land in the gallery via the platform's media store.

### Knowing what is happening

Three places tell the user a download is in flight, because one is never enough:

| Where | What it shows |
| --- | --- |
| **Notification shade** | Live progress bar with percent and MB, on a low-importance channel so it updates silently. Becomes "Download complete — tap to play" when it lands, or the failure reason if it does not. |
| **Floating bar** | Sits above the nav on every tab: progress ring, title, `47% · 12 MB of 26 MB`, and an ✕ to cancel. Turns green for six seconds when a download finishes. Tap it to jump to Files. |
| **Files tab** | Per-download progress bar, cancel, share, and where the file landed. |

Notification permission is requested after the first frame, never on the splash, and everything degrades quietly if the user declines.

### Built-in player

Finished files play inside the app — tap the row in Files, the floating bar, or the notification. Play/pause, ±10 s skip, a scrub bar and a time/size readout. Audio files show artwork instead of a black frame. If a codec will not decode, the screen offers "Open in another app" rather than failing silently.

### Tools tab — 13 tools, all on-device

A **search box** filters by name, tagline, category or slug, with a clear button and a "no match" state that suggests terms.

| Group | Tools |
| --- | --- |
| Image | Converter (JPG/PNG), Compressor with quality slider, Resizer with aspect lock |
| Text | Word counter, Case converter (9 cases), JSON formatter, Base64, URL encoder, Hash (SHA-1…512), Slug generator |
| Generators | Password with entropy meter, UUID v4, Lorem ipsum |

Image work runs on a **background isolate** via `package:image`, so a 4000px photo never janks the UI. Hashes use `package:crypto`; randomness uses `Random.secure()`.

### Files tab
Every download from the session with progress, cancel, share, and where the file landed.

### Blog + More
Guides pulled from `/api/blog` with a small markdown renderer, plus contact form, theme switch (dark / light / system) and links to the legal pages.

---

## Architecture

```
lib/
├── core/
│   ├── config.dart       # API base, injected at build time
│   ├── api.dart          # typed client; every failure becomes a readable message
│   ├── models.dart       # ResolvedMedia, MediaFormat, Platform, BlogPost
│   ├── platforms.dart    # offline link detection + URL normalisation
│   ├── downloads.dart    # streaming download queue, permissions, gallery save
│   ├── image_tools.dart  # isolate-backed convert / compress / resize
│   ├── text_tools.dart   # pure functions behind the text + generator tools
│   └── notifications.dart # progress, completion and failure notifications
├── screens/              # home · result sheet · tools · files · player · blog · more
├── widgets/
│   ├── common.dart       # Surface, GradientButton, Aurora, staggered animations
│   └── download_bar.dart # the floating progress strip
└── main.dart             # theme mode, navigation shell
```

The app talks to four endpoints: `POST /api/resolve`, `GET /api/download`, `GET /api/blog`, `POST /api/contact`. It also reads `GET /api/services`, so a service switched off in the admin panel disappears from the app without a new release.

---

## Design

The palette, radii and motion mirror the website: brand `#7048F0` → accent `#14C8BE`, Plus Jakarta Sans via `google_fonts`, 20px card radii, and an animated aurora behind the hero.

Motion is deliberate rather than decorative — staggered list entrances, a 200ms cross-fade on segmented controls, spring physics on the nav indicator, and a shimmer on loading skeletons. Everything sits under ~400ms so it never feels slow.

---

## Permissions

| Platform | Permission | Why |
| --- | --- | --- |
| Android ≤12 | `WRITE_EXTERNAL_STORAGE` | save downloads to shared storage |
| Android 13+ | `READ_MEDIA_IMAGES` / `VIDEO` / `AUDIO` | pick images for the tools, write to the gallery |
| Android 13+ | `POST_NOTIFICATIONS` | download progress and completion alerts |
| Android | `INTERNET`, `ACCESS_NETWORK_STATE` | talk to the API |
| iOS | `NSPhotoLibraryAddUsageDescription` | save downloads to Photos |
| iOS | `NSPhotoLibraryUsageDescription` | pick images for the tools |

Permissions are requested at the moment they are needed, never on launch. If the user declines, files still save to the app's own directory and can be shared out — the app degrades rather than failing.

---

## Icons and splash

Generated from `assets/icon/icon.png` (1024×1024):

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

Android gets an adaptive icon (brand background + white glyph foreground); iOS gets a flattened, alpha-free icon.

---

## Testing

```bash
flutter analyze   # 0 issues
flutter test      # 10 unit tests
```

The tests cover link detection across all platforms, URL normalisation and tracking-parameter stripping, the nine case conversions, Base64 round-tripping with emoji, the known SHA-256 vector for `"abc"`, UUID v4 layout and password generation.

Verified on a **Galaxy S23 FE** against a live server with a real RapidAPI key: clipboard detection picked up a copied YouTube link on its own, the platform badge lit up, 25 formats came back, and a **41 MB MP4 downloaded to completion and saved to the gallery**. Also verified on an Android 17 emulator across all five tabs.

---

## Build notes

`flutter_local_notifications` needs **core library desugaring**, which the Flutter scaffold does not enable. It is switched on in `android/app/build.gradle.kts` with `desugar_jdk_libs`; without it the release build fails at `checkReleaseAarMetadata`.

---

## Known limitations

- **WEBP encoding** is not available on-device, so the image converter offers JPG and PNG output. WEBP files can still be read in.
- **PDF tools are web-only** for now; `pdf-lib` has no Dart equivalent in this project yet.
- iOS builds have not been run on hardware here — no macOS signing identity was configured. The Android path is verified end to end.
- The notification, floating bar, player, save-button spinner and tool search all compile clean and pass the analyzer, but have **not yet been watched running on a physical device** — the test phone was in use. The download pipeline underneath them is verified (a 41 MB YouTube video downloaded and saved to the gallery on a Galaxy S23 FE).
