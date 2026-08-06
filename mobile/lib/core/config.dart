/// Where the app talks to. Override at build time without touching code:
///   flutter run --dart-define=SNAPGRAB_API=https://snapgrab.app
///
/// The default points at a LAN address so the app works against `next dev`
/// on the same Wi-Fi during development.
class AppConfig {
  static const String apiBase = String.fromEnvironment(
    'SNAPGRAB_API',
    defaultValue: 'http://192.168.1.41:3001',
  );

  static const String siteName = 'SnapGrab';
  static const String supportEmail = 'support@snapgrab.app';

  /// Requests that hit the network get this ceiling; resolves can be slow.
  static const Duration timeout = Duration(seconds: 30);
}
