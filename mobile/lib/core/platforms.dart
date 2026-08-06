import 'package:flutter/material.dart';

/// Local mirror of the web platform registry, so link detection works offline
/// and instantly as the user types. The live list from /api/services still
/// decides what is shown and downloadable.
class LocalPlatform {
  const LocalPlatform(this.id, this.name, this.color, this.hosts);
  final String id;
  final String name;
  final Color color;
  final List<String> hosts;
}

const kPlatforms = <LocalPlatform>[
  LocalPlatform('youtube', 'YouTube', Color(0xFFFF0033),
      ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com']),
  LocalPlatform('instagram', 'Instagram', Color(0xFFE1306C), ['instagram.com', 'instagr.am', 'ddinstagram.com']),
  LocalPlatform('facebook', 'Facebook', Color(0xFF1877F2),
      ['facebook.com', 'fb.watch', 'fb.com', 'm.facebook.com', 'web.facebook.com']),
  LocalPlatform('tiktok', 'TikTok', Color(0xFF00F2EA), ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com']),
  LocalPlatform('twitter', 'X (Twitter)', Color(0xFF111827), ['twitter.com', 'x.com', 't.co', 'mobile.twitter.com']),
  LocalPlatform('pinterest', 'Pinterest', Color(0xFFE60023),
      ['pinterest.com', 'pin.it', 'pinterest.co.uk', 'pinterest.ca']),
  LocalPlatform('snapchat', 'Snapchat', Color(0xFFFFD400), ['snapchat.com', 't.snapchat.com']),
  LocalPlatform('linkedin', 'LinkedIn', Color(0xFF0A66C2), ['linkedin.com', 'lnkd.in']),
  LocalPlatform('reddit', 'Reddit', Color(0xFFFF4500), ['reddit.com', 'redd.it', 'v.redd.it', 'old.reddit.com']),
  LocalPlatform('vimeo', 'Vimeo', Color(0xFF1AB7EA), ['vimeo.com', 'player.vimeo.com']),
  LocalPlatform('dailymotion', 'Dailymotion', Color(0xFF0066DC), ['dailymotion.com', 'dai.ly']),
  LocalPlatform('soundcloud', 'SoundCloud', Color(0xFFFF5500), ['soundcloud.com', 'on.soundcloud.com', 'snd.sc']),
  LocalPlatform('threads', 'Threads', Color(0xFF444444), ['threads.net', 'threads.com']),
  LocalPlatform('twitch', 'Twitch', Color(0xFF9146FF), ['twitch.tv', 'clips.twitch.tv', 'm.twitch.tv']),
];

/// Accepts bare links like `youtu.be/x` and strips tracking parameters.
String? normalizeUrl(String input) {
  final raw = input.trim().replaceAll(RegExp(r'\s+'), '');
  if (raw.isEmpty) return null;
  final withProto = RegExp(r'^https?://', caseSensitive: false).hasMatch(raw) ? raw : 'https://$raw';
  final uri = Uri.tryParse(withProto);
  if (uri == null || !uri.host.contains('.')) return null;

  const junk = {'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'igshid'};
  final params = Map<String, String>.from(uri.queryParameters)..removeWhere((k, _) => junk.contains(k));
  return uri.replace(queryParameters: params.isEmpty ? null : params).toString();
}

LocalPlatform? detectPlatform(String input) {
  final url = normalizeUrl(input);
  if (url == null) return null;
  final host = Uri.tryParse(url)?.host.toLowerCase().replaceFirst(RegExp(r'^www\.'), '');
  if (host == null) return null;
  for (final p in kPlatforms) {
    if (p.hosts.any((h) => host == h || host.endsWith('.$h'))) return p;
  }
  return null;
}

/// True when the text looks like a link we could try to resolve.
bool looksLikeLink(String text) {
  final t = text.trim();
  if (t.length < 8 || t.contains('\n')) return false;
  return RegExp(r'^(https?://)?[\w.-]+\.[a-z]{2,}(/|$)', caseSensitive: false).hasMatch(t);
}
