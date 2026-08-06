import 'package:flutter_test/flutter_test.dart';

import 'package:snapgrab_app/core/platforms.dart';
import 'package:snapgrab_app/core/text_tools.dart';

void main() {
  group('link detection', () {
    test('recognises every supported platform from a bare link', () {
      expect(detectPlatform('youtu.be/dQw4w9WgXcQ')?.id, 'youtube');
      expect(detectPlatform('https://www.instagram.com/reel/abc/')?.id, 'instagram');
      expect(detectPlatform('https://vm.tiktok.com/xyz')?.id, 'tiktok');
      expect(detectPlatform('https://x.com/i/status/1')?.id, 'twitter');
      expect(detectPlatform('https://example.com/video'), isNull);
    });

    test('strips tracking parameters', () {
      final url = normalizeUrl('https://youtu.be/abc?utm_source=news&t=30');
      expect(url, contains('t=30'));
      expect(url, isNot(contains('utm_source')));
    });

    test('rejects text that is not a link', () {
      expect(looksLikeLink('just some words'), isFalse);
      expect(looksLikeLink('https://youtu.be/abc'), isTrue);
    });
  });

  group('text tools', () {
    test('converts cases correctly', () {
      expect(TextTools.camel('hello world from snapGrab'), 'helloWorldFromSnapGrab');
      expect(TextTools.kebab('Héllo World! Café'), 'hello-world-cafe');
      expect(TextTools.constant('one two'), 'ONE_TWO');
    });

    test('round-trips base64 including unicode', () {
      const input = 'héllo wörld 🎉';
      expect(TextTools.decodeBase64(TextTools.encodeBase64(input)), input);
    });

    test('produces the known SHA-256 digest for "abc"', () {
      expect(TextTools.hashes('abc')['SHA-256'],
          'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    test('counts words and reading time', () {
      final s = TextTools.stats('The quick brown fox jumps over the lazy dog.');
      expect(s.words, 9);
      expect(s.sentences, 1);
    });
  });

  group('generators', () {
    test('uuid v4 matches the RFC layout', () {
      final id = Generators.uuidV4();
      expect(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$').hasMatch(id), isTrue);
    });

    test('passwords honour length and character sets', () {
      final pw = Generators.password(length: 24, useSymbols: false, useUpper: false);
      expect(pw.length, 24);
      expect(RegExp(r'^[a-z0-9]+$').hasMatch(pw), isTrue);
    });

    test('two passwords are not the same', () {
      expect(Generators.password(), isNot(Generators.password()));
    });
  });
}
