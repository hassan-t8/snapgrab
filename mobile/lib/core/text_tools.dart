import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// Pure functions behind the text and generator tools — no state, easy to trust.
class TextTools {
  TextTools._();

  static List<String> _words(String s) =>
      s.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();

  static ({
    int words,
    int characters,
    int charactersNoSpaces,
    int sentences,
    int paragraphs,
    int lines,
    String readingTime,
    String longestWord,
  }) stats(String text) {
    final w = _words(text);
    final minutes = w.length / 200;
    return (
      words: w.length,
      characters: text.length,
      charactersNoSpaces: text.replaceAll(RegExp(r'\s'), '').length,
      sentences: text.split(RegExp(r'[.!?]+(\s|$)')).where((s) => s.trim().isNotEmpty).length,
      paragraphs: text.split(RegExp(r'\n{2,}')).where((p) => p.trim().isNotEmpty).length,
      lines: text.isEmpty ? 0 : text.split('\n').length,
      readingTime: minutes == 0
          ? '0 min'
          : minutes < 1
              ? 'under 1 min'
              : '${minutes.round()} min',
      longestWord: w.fold<String>('', (a, b) => b.length > a.length ? b : a),
    );
  }

  static List<String> _parts(String s) => _stripAccents(s)
      .split(RegExp(r'[^\p{L}\p{N}]+|(?<=\p{Ll})(?=\p{Lu})', unicode: true))
      .where((p) => p.isNotEmpty)
      .toList();

  static const _accents = 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçšž';
  static const _plain = 'aaaaaaeeeeiiiiooooouuuuyyncsz';

  static String _stripAccents(String s) {
    final buffer = StringBuffer();
    for (final ch in s.split('')) {
      final i = _accents.indexOf(ch.toLowerCase());
      if (i == -1) {
        buffer.write(ch);
      } else {
        final replacement = _plain[i];
        buffer.write(ch == ch.toUpperCase() ? replacement.toUpperCase() : replacement);
      }
    }
    return buffer.toString();
  }

  static String upper(String s) => s.toUpperCase();
  static String lower(String s) => s.toLowerCase();

  static String title(String s) => s.toLowerCase().replaceAllMapped(
        RegExp(r'(^|\s|["\x27(\[{])(\p{L})', unicode: true),
        (m) => '${m[1]}${m[2]!.toUpperCase()}',
      );

  static String sentence(String s) => s.toLowerCase().replaceAllMapped(
        RegExp(r'(^\s*|[.!?]\s+)(\p{L})', unicode: true),
        (m) => '${m[1]}${m[2]!.toUpperCase()}',
      );

  static String camel(String s) {
    final p = _parts(s);
    if (p.isEmpty) return '';
    return p.first.toLowerCase() +
        p.skip(1).map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase()).join();
  }

  static String pascal(String s) =>
      _parts(s).map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase()).join();

  static String snake(String s) => _parts(s).map((w) => w.toLowerCase()).join('_');
  static String kebab(String s) => _parts(s).map((w) => w.toLowerCase()).join('-');
  static String constant(String s) => _parts(s).map((w) => w.toUpperCase()).join('_');

  static String slug(String s) => kebab(s);

  static String encodeBase64(String s) => base64Encode(utf8.encode(s));

  static String decodeBase64(String s) =>
      utf8.decode(base64Decode(s.trim().replaceAll(RegExp(r'\s'), '')));

  static String encodeUrl(String s) => Uri.encodeComponent(s);
  static String decodeUrl(String s) => Uri.decodeComponent(s);

  static String prettyJson(String s) =>
      const JsonEncoder.withIndent('  ').convert(jsonDecode(s));

  static String minifyJson(String s) => jsonEncode(jsonDecode(s));

  static Map<String, String> hashes(String s) {
    final bytes = utf8.encode(s);
    return {
      'SHA-1': sha1.convert(bytes).toString(),
      'SHA-256': sha256.convert(bytes).toString(),
      'SHA-384': sha384.convert(bytes).toString(),
      'SHA-512': sha512.convert(bytes).toString(),
    };
  }
}

class Generators {
  Generators._();

  static final _rng = Random.secure();

  static const lower = 'abcdefghijklmnopqrstuvwxyz';
  static const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  static const digits = '0123456789';
  static const symbols = '!@#\$%^&*()-_=+[]{};:,.?/';

  static String password({
    int length = 20,
    bool useLower = true,
    bool useUpper = true,
    bool useDigits = true,
    bool useSymbols = true,
    bool avoidAmbiguous = false,
  }) {
    var alphabet = [
      if (useLower) lower,
      if (useUpper) upper,
      if (useDigits) digits,
      if (useSymbols) symbols,
    ].join();
    if (avoidAmbiguous) alphabet = alphabet.replaceAll(RegExp(r'[Il1O0]'), '');
    if (alphabet.isEmpty) return '';
    return List.generate(length, (_) => alphabet[_rng.nextInt(alphabet.length)]).join();
  }

  static double entropyBits(int length, int alphabetSize) =>
      alphabetSize <= 1 ? 0 : length * (log(alphabetSize) / log(2));

  /// RFC 4122 version 4, from a cryptographically secure source.
  static String uuidV4() {
    final b = List<int>.generate(16, (_) => _rng.nextInt(256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    final hex = b.map((n) => n.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  static const _loremWords =
      'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et '
      'dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea '
      'commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur';

  static String lorem({required String unit, required int amount, int seed = 1}) {
    final words = _loremWords.split(' ');
    String pick(int n, int s) =>
        List.generate(n, (i) => words[(i * 7 + s * 13) % words.length]).join(' ');
    String sentenceAt(int i, int s) {
      final text = pick(8 + ((i * 5 + s) % 10), s + i);
      return '${text[0].toUpperCase()}${text.substring(1)}.';
    }

    return switch (unit) {
      'words' => pick(amount, seed),
      'sentences' => List.generate(amount, (i) => sentenceAt(i, seed)).join(' '),
      _ => List.generate(
          amount,
          (i) => List.generate(4 + ((i + seed) % 3), (j) => sentenceAt(i * 4 + j, seed)).join(' '),
        ).join('\n\n'),
    };
  }
}
