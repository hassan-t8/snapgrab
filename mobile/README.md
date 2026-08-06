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

### First launch

A branded **splash** holds the first frame while the app initialises — the mark scales in with a shimmer over the same aurora the rest of the app uses, so it belongs to the product rather than being a stock loader.

**Onboarding** then runs, once and only once. Four slides explain the paste-a-link flow, the format picker, the offline tools and the download notifications, each with a colour that bleeds into the background so progress is felt as well as seen. Skip is always available. The completion flag lives in `SharedPreferences` and is covered by tests, so a relaunch goes straight to the app.

Notification permission is requested at the **end of onboarding**, where the last slide has just explained what the notifications are for — not on the splash, where it would be an ambush. Returning users who updated into this build are asked once on first open instead.

### Download tab
- **Clipboard detection** — the app checks the clipboard on launch and every time it returns to the foreground, so a link copied in YouTube or Instagram is picked up before you touch anything.
- **Live platform badge** as you type, from a local registry of all 14 platforms, so detection is instant and works offline.
- Results open in a draggable sheet grouped into **Video / Audio / Images**, with quality, container and file size on every row.
- Tapping a quality shows a **spinner on that row** immediately, so the tap visibly registers before the sheet closes.
- A **skeleton card** with a shimmer fills the gap while the server reads the link, so the wait has a shape instead of a frozen button.
- **Recent links** — the last five resolved URLs, each tagged with its platform colour, re-download in one tap. Clearable.
- Downloads **stream to disk with live progress**, can be cancelled mid-flight, and land in the gallery via the platform's media store.
- Haptics confirm the outcome: a medium tap on success, a heavier one on failure.

### Knowing what is happening

Three places tell the user a download is in flight, because one is never enough:

| Where | What it shows |
| --- | --- |
| **Notification shade** | Live progress bar with percent and MB, on a low-importance channel so it updates silently. |
| **Floating bar** | Sits above the nav on every tab: progress ring, title, `47% · 12 MB of 26 MB`, and an ✕ to cancel. Turns green for six seconds when a download finishes. Tap it to jump to Files. |
| **Files tab** | Per-download progress bar, cancel, share, and where the file landed. |

The notification carries buttons, so the shade is a real control surface rather than a read-only readout:

| State | Notification | Buttons |
| --- | --- | --- |
| Downloading | `47%  ·  12 MB of 26 MB` with a progress bar | **Cancel** — stops that exact download |
| Finished | "Download complete — tap to play" | **Play** — opens the in-app player |
| Cancelled | "Download cancelled" | none; clears itself after 8 s |
| Failed | The reason, in plain English | none |

Tapping the body of a finished notification does the same as **Play**. The payload carries `task:<id>` while a download runs so Cancel knows which one to stop, and the file path once it finishes so Play knows what to open — and the player gets the real video title rather than the on-disk filename.

Everything degrades quietly if the user declines the permission — the floating bar and Files tab still report progress.

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

### Contact support

A form built to be answered rather than ignored: a header card stating the response time and support address, **subject chips** instead of a dropdown, and a message hint that changes with the subject — pick "A link failed" and it asks for the link you tried. There is a live character counter, inline validation that names the actual problem, and a success state that confirms which address the reply is going to. A footer states plainly what is stored and links to the privacy policy.

### Blog + More
Guides pulled from `/api/blog` with a small markdown renderer, plus theme switch (dark / light / system) and links to the legal pages.

---

## Architecture

```
lib/
├── core/
│   ├── config.dart       # API base, injected at build time
│   ├── prefs.dart        # onboarding flag and recent links
│   ├── api.dart          # typed client; every failure becomes a readable message
│   ├── models.dart       # ResolvedMedia, MediaFormat, Platform, BlogPost
│   ├── platforms.dart    # offline link detection + URL normalisation
│   ├── downloads.dart    # streaming download queue, permissions, gallery save
│   ├── image_tools.dart  # isolate-backed convert / compress / resize
│   ├── text_tools.dart   # pure functions behind the text + generator tools
│   └── notifications.dart # progress, completion and failure notifications
├── screens/              # splash · onboarding · home · result sheet · tools
│                         # files · player · blog · contact · more
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
flutter test      # 16 unit tests
```

The tests cover link detection across all platforms, URL normalisation and tracking-parameter stripping, the nine case conversions, Base64 round-tripping with emoji, the known SHA-256 vector for `"abc"`, UUID v4 layout, password generation, and the onboarding flag surviving a relaunch so the intro cannot run twice.

Verified on a **Galaxy S23 FE** against a live server with a real RapidAPI key: clipboard detection picked up a copied YouTube link on its own, the platform badge lit up, 25 formats came back, and a **41 MB MP4 downloaded to completion and saved to the gallery**. Also verified on an Android 17 emulator across all five tabs.

---

## Build notes

`flutter_local_notifications` needs **core library desugaring**, which the Flutter scaffold does not enable. It is switched on in `android/app/build.gradle.kts` with `desugar_jdk_libs`; without it the release build fails at `checkReleaseAarMetadata`.

---

## Known limitations

- **WEBP encoding** is not available on-device, so the image converter offers JPG and PNG output. WEBP files can still be read in.
- **PDF tools are web-only** for now; `pdf-lib` has no Dart equivalent in this project yet.
- iOS builds have not been run on hardware here — no macOS signing identity was configured. The Android path is verified end to end.
- **Verified on a Galaxy S23 FE:** the splash, the first onboarding slide, the contact screen (including the subject-aware message hint), clipboard detection, resolving a real link into 25 formats, and a 41 MB MP4 downloading to completion and saving to the gallery.
- **Not yet watched on the device:** the notification buttons, the floating bar, the player, the recent-links strip and tool search. They compile clean, pass the analyzer and ship in an APK that installs — but the test handset was in active use, so nothing here claims more than that. The once-only onboarding flag is covered by tests rather than a device run.
