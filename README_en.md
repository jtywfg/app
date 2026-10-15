# PinPic V1

PinPic is a local-first photo collage and editing app for Android and iOS. Once its standalone app is installed, photo selection, collage editing and saving work on the device without an internet connection. The app does not upload photos or call a backend.

## V1 features

V1.1.1 replaces edge-color background flood fill with bundled Android ML Kit person segmentation and iOS Vision accurate person segmentation. Foreground clothing keeps its original RGB; optional brightness/warmth are limited to a face ellipse. Intermediate composites are PNG. Segmentation is probabilistic: inspect hair and garment edges before using a result for an official submission. Android's model is packaged in the APK and requires no photo upload or first-run model download.

The file-size utility now offers independent width/height, px/mm conversion at 300 DPI, a JPEG quality slider, and the measured encoded file size. The pixel-size utility offers searchable size presets, custom dimensions, a dismissible pinch tutorial, bounded pan/zoom cropping, confirmation preview, and gallery export. Cropping uses original source pixels rather than screen capture. Dimension conversion and crop mapping have automated coverage.

The formalwear overlay is scaled 1.35× about the centered bottom edge so its collar rises to the neck area and the shoulders cover more of the original top. The style strip previews each actual SVG garment instead of using a generic symbol. Suit scale and anchor geometry have regression tests. These remain graphic overlays, not AI garment fitting; preview before export.

Validation: TypeScript, ESLint, 21 unit tests, Expo Doctor (21 checks), native-module autolinking and Swift syntax parsing pass. Swift parsing does not substitute for an iOS device build. Device segmentation quality and gesture interactions still need real-device validation.

V1.0.5 adds vertical long-image stitching with full-length preview/export and an interactive grid-splitting editor (3, 6, 9 or 12 slices, with single-slice and save-all actions). Album tabs now have fixed first-frame sizing, layout previews give more space to the canvas, and collage dividers show a prominent purple drag handle that is omitted from saved images. V1.0.4 added direct touch gestures to collage editors. Drag a photo inside its frame to adjust crop; drag a divider to resize linked layout regions. In Free Collage, drag with one finger and pinch/rotate with two fingers. Selection outlines are hidden while saving. Android gallery saves are written into the public `DCIM/PinPic` folder and checked in MediaStore before success is reported; iOS results are saved into the system photo library. V1.0.2 also fixed Android photo selection failures shared by Quick Collage, Edit, Layout and Free Collage. Android uses the local gallery URI directly instead of requesting full EXIF/location metadata. No additional location permission is required. iOS still resolves library assets to local files before editing. The installed app icon uses the supplied 400x400ia-75.webp artwork, converted to PNG for native builds.

V1.0.1 uses an in-app photo album for all four entry points. Grant full photo access to browse the entire device library (partial access is explicitly identified). Multi-selection persists across album tabs, with ordered thumbnails and removal in the bottom tray; only Next submits the selection. The single-photo flow includes a camera tile. Crop supports dragging the rectangle, four edges and four corners, with actual pixel cropping on confirmation. Text and stickers can be dragged and individually removed; selection indicators are omitted when exporting.

Cloud-only iCloud photos may require internet to download before editing. Locally available photos work offline.

- Quick collage: select 2–9 photos, choose a canvas ratio and layout, adjust the collage, and save it to Photos/Gallery.
- Layout collage: select photos, compare layout previews in the bottom carousel, then continue to editing.
- Single-photo editor: crop by aspect ratio, choose a filter, adjust brightness/zoom/rotation, add text and stickers, and save.
- Free collage: confirm selected photos, tap Next, freely drag/resize/rotate them, then save.
- Settings clearly identifies the first release as free. There is no purchase or subscription flow.

Edits are composed locally in the app and exported to the device photo library. Access to the photo library is requested only when needed.

## Run during development

```sh
npm install
npx expo start
```

Development mode needs a computer running the bundler. For independent offline use, build and install a standalone app as described below.

## Build installable apps with EAS

The project includes an internal-distribution profile: Android builds are APKs; iOS builds are signed for registered test devices. EAS builds run remotely, so Xcode and Android Studio are not needed on this Mac. The initial EAS setup/build does require internet access.

1. Install/login to EAS and link this app to your EAS project:

   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest build:configure
   ```

2. Keep the existing application identifier `com.pinpic.app` for updates. The project is currently linked to `@nihaoa666s-team/pinpic-v1`. Android preview builds reuse the original signing key through the ignored local `credentials.json` and `credentials/android/keystore.jks`; both files must be present on the build-submit machine. Keep them private and backed up. Changing Expo accounts must not change the Android package or signing key if the APK should update an existing installation.
3. Build the APK:

   ```sh
   npx eas-cli@latest build --platform android --profile preview
   ```

4. Build iOS for registered devices:

   ```sh
   npx eas-cli@latest build --platform ios --profile preview
   ```

   EAS will guide you through Apple signing and provisioning. Ad Hoc installation requires an Apple Developer account and the target iPhone/iPad UDIDs to be included in the provisioning profile. Install the generated build using the EAS install link on each registered device.

The production profile is intended for later store distribution, not direct device installation. App updates/builds are not fetched automatically; the installed V1 works offline with its bundled JavaScript and native modules.

## Project notes

- Custom formalwear: 14 men's and 4 women's garments are bundled locally; the 3 existing children's SVG styles remain available. Original PNG/WebP files remain in `assets/formalwear/men` and `women`. Runtime images in `assets/formalwear/prepared` are transparent cropped PNGs, including background removal for the solid-background WebPs. Regenerate on macOS with `node scripts/prepare-formalwear.cjs`. Register assets with static `require` entries and their prepared dimensions in `src/lib/formalwear.ts`. Preview and print export share fitting coordinates, and saving waits for portrait and garment images to load.

- 1.1.3: formalwear supports single-finger translation and two-finger scale/rotation, face-based initial collar placement, and a reset action. Electronic and print exports share the same normalized placement. Fabric shading and neckline curves improve the graphic overlay; this is not generative AI dressing and cannot reconstruct the original clothing or guarantee a photorealistic fit. All fitting remains on-device.

- Expo SDK 57 / React Native 0.86.
- Native folders are generated by Expo Prebuild/EAS; do not hand-edit generated `ios/` or `android/` folders.
- Some V1 effects are intentionally lightweight overlays so the editor remains self-contained and works offline.
