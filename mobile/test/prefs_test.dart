import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:snapgrab_app/core/prefs.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('onboarding runs exactly once', () {
    test('a fresh install has not onboarded', () async {
      SharedPreferences.setMockInitialValues({});
      await Prefs.init();
      expect(Prefs.hasOnboarded, isFalse);
    });

    test('finishing onboarding is remembered', () async {
      SharedPreferences.setMockInitialValues({});
      await Prefs.init();
      await Prefs.setOnboarded();
      expect(Prefs.hasOnboarded, isTrue);
    });

    test('the flag survives a relaunch', () async {
      SharedPreferences.setMockInitialValues({});
      await Prefs.init();
      await Prefs.setOnboarded();

      // simulate the app starting again against the same store
      await Prefs.init();
      expect(Prefs.hasOnboarded, isTrue, reason: 'onboarding must not show a second time');
    });
  });

  group('recent links', () {
    test('start empty', () async {
      SharedPreferences.setMockInitialValues({});
      await Prefs.init();
      expect(Prefs.recentLinks, isEmpty);
    });

    test('newest first, no duplicates, capped at five', () async {
      SharedPreferences.setMockInitialValues({});
      await Prefs.init();

      for (final url in ['a', 'b', 'c', 'd', 'e', 'f']) {
        await Prefs.addRecentLink(url);
      }
      expect(Prefs.recentLinks, ['f', 'e', 'd', 'c', 'b']);

      // re-adding an existing link moves it to the front rather than duplicating
      await Prefs.addRecentLink('c');
      expect(Prefs.recentLinks.first, 'c');
      expect(Prefs.recentLinks.where((u) => u == 'c').length, 1);
      expect(Prefs.recentLinks.length, 5);
    });

    test('can be cleared', () async {
      SharedPreferences.setMockInitialValues({});
      await Prefs.init();
      await Prefs.addRecentLink('https://youtu.be/x');
      await Prefs.clearRecentLinks();
      expect(Prefs.recentLinks, isEmpty);
    });
  });
}
