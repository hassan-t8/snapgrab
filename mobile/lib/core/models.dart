import 'package:flutter/material.dart';

Color _hex(String? value, Color fallback) {
  if (value == null) return fallback;
  final v = value.replaceFirst('#', '');
  final parsed = int.tryParse(v.length == 6 ? 'FF$v' : v, radix: 16);
  return parsed == null ? fallback : Color(parsed);
}

class MediaFormat {
  MediaFormat({
    required this.id,
    required this.url,
    required this.quality,
    required this.ext,
    required this.kind,
    required this.label,
    this.sizeBytes,
    this.hasAudio = true,
  });

  final String id;
  final String url;
  final String quality;
  final String ext;
  final String kind; // video | audio | image
  final String label;
  final int? sizeBytes;
  final bool hasAudio;

  bool get isAudio => kind == 'audio';
  bool get isImage => kind == 'image';

  factory MediaFormat.fromJson(Map<String, dynamic> j) => MediaFormat(
        id: (j['id'] ?? '').toString(),
        url: (j['url'] ?? '').toString(),
        quality: (j['quality'] ?? 'Original').toString(),
        ext: (j['ext'] ?? 'mp4').toString(),
        kind: (j['kind'] ?? 'video').toString(),
        label: (j['label'] ?? '').toString(),
        sizeBytes: j['sizeBytes'] is num ? (j['sizeBytes'] as num).toInt() : null,
        hasAudio: j['hasAudio'] != false,
      );
}

class ResolvedMedia {
  ResolvedMedia({
    required this.platform,
    required this.platformName,
    required this.sourceUrl,
    required this.title,
    required this.formats,
    this.author,
    this.thumbnail,
    this.durationSec,
    this.cached = false,
    this.demo = false,
  });

  final String platform;
  final String platformName;
  final String sourceUrl;
  final String title;
  final List<MediaFormat> formats;
  final String? author;
  final String? thumbnail;
  final int? durationSec;
  final bool cached;
  final bool demo;

  factory ResolvedMedia.fromJson(Map<String, dynamic> j) => ResolvedMedia(
        platform: (j['platform'] ?? 'unknown').toString(),
        platformName: (j['platformName'] ?? 'Media').toString(),
        sourceUrl: (j['sourceUrl'] ?? '').toString(),
        title: (j['title'] ?? 'Untitled').toString(),
        author: j['author']?.toString(),
        thumbnail: j['thumbnail']?.toString(),
        durationSec: j['durationSec'] is num ? (j['durationSec'] as num).toInt() : null,
        cached: j['cached'] == true,
        demo: j['demo'] == true,
        formats: ((j['formats'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(MediaFormat.fromJson)
            .toList(),
      );
}

class Platform {
  Platform({
    required this.id,
    required this.name,
    required this.slug,
    required this.color,
    required this.blurb,
    required this.hosts,
    required this.formats,
  });

  final String id;
  final String name;
  final String slug;
  final Color color;
  final String blurb;
  final List<String> hosts;
  final List<String> formats;

  factory Platform.fromJson(Map<String, dynamic> j) => Platform(
        id: (j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        color: _hex(j['color']?.toString(), const Color(0xFF7048F0)),
        blurb: (j['blurb'] ?? '').toString(),
        hosts: ((j['hosts'] as List?) ?? []).map((e) => e.toString()).toList(),
        formats: ((j['formats'] as List?) ?? []).map((e) => e.toString()).toList(),
      );
}

class RemoteTool {
  RemoteTool({
    required this.slug,
    required this.name,
    required this.category,
    required this.tagline,
    required this.color,
    required this.engine,
    required this.outputs,
    this.mode,
  });

  final String slug;
  final String name;
  final String category;
  final String tagline;
  final Color color;
  final String engine;
  final String? mode;
  final List<String> outputs;

  factory RemoteTool.fromJson(Map<String, dynamic> j) => RemoteTool(
        slug: (j['slug'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        category: (j['category'] ?? '').toString(),
        tagline: (j['tagline'] ?? '').toString(),
        color: _hex(j['color']?.toString(), const Color(0xFF7048F0)),
        engine: (j['engine'] ?? '').toString(),
        mode: j['mode']?.toString(),
        outputs: ((j['outputs'] as List?) ?? []).map((e) => e.toString()).toList(),
      );
}

class BlogPost {
  BlogPost({
    required this.slug,
    required this.title,
    required this.excerpt,
    required this.tags,
    required this.author,
    required this.createdAt,
    this.cover,
    this.content,
    this.views = 0,
    int? readingMinutes,
  }) : _readingMinutes = readingMinutes;

  final String slug;
  final String title;
  final String excerpt;
  final List<String> tags;
  final String author;
  final DateTime createdAt;
  final String? cover;
  final String? content;
  final int views;
  final int? _readingMinutes;

  /// The server sends this with the summary, because the list response has no body.
  int get readingMinutes {
    if (_readingMinutes != null) return _readingMinutes;
    final words = (content ?? excerpt).split(RegExp(r'\s+')).length;
    return (words / 220).ceil().clamp(1, 60);
  }

  factory BlogPost.fromJson(Map<String, dynamic> j) => BlogPost(
        slug: (j['slug'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        excerpt: (j['excerpt'] ?? '').toString(),
        cover: j['cover']?.toString(),
        content: j['content']?.toString(),
        author: (j['author'] ?? 'SnapGrab Team').toString(),
        views: j['views'] is num ? (j['views'] as num).toInt() : 0,
        tags: ((j['tags'] as List?) ?? []).map((e) => e.toString()).toList(),
        readingMinutes: j['readingMinutes'] is num ? (j['readingMinutes'] as num).toInt() : null,
        createdAt: DateTime.tryParse((j['createdAt'] ?? '').toString()) ?? DateTime.now(),
      );
}

class ApiException implements Exception {
  ApiException(this.message, {this.code});
  final String message;
  final String? code;
  @override
  String toString() => message;
}
