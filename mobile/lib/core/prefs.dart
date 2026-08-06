import 'package:shared_preferences/shared_preferences.dart';

/// Small typed wrapper over SharedPreferences so screens never touch raw keys.
class Prefs {
  Prefs._();

  static const _onboarded = 'sg_onboarded_v1';
  static const _recentLinks = 'sg_recent_links';

  static SharedPreferences? _p;

  static Future<void> init() async {
    try {
      _p = await SharedPreferences.getInstance();
    } catch (_) {
      // a broken preference store must not stop the app from starting
    }
  }

  /// True once the user has finished onboarding, so it only ever runs once.
  static bool get hasOnboarded => _p?.getBool(_onboarded) ?? false;

  static Future<void> setOnboarded() async {
    try {
      await _p?.setBool(_onboarded, true);
    } catch (_) {}
  }

  /// The last few links the user resolved, newest first.
  static List<String> get recentLinks => _p?.getStringList(_recentLinks) ?? const [];

  static Future<void> addRecentLink(String url) async {
    try {
      final list = [url, ...recentLinks.where((u) => u != url)].take(5).toList();
      await _p?.setStringList(_recentLinks, list);
    } catch (_) {}
  }

  static Future<void> clearRecentLinks() async {
    try {
      await _p?.remove(_recentLinks);
    } catch (_) {}
  }
}
