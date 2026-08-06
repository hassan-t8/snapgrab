import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

/// Thin client over the SnapGrab web API. Every method throws [ApiException]
/// with a message that is already safe to show a user.
class Api {
  Api._();
  static final Api instance = Api._();

  final http.Client _client = http.Client();

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${AppConfig.apiBase}$path').replace(queryParameters: query);

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> json;
    try {
      json = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException('The server sent an unexpected response.');
    }
    if (res.statusCode >= 400 || json['ok'] != true) {
      throw ApiException(
        (json['error'] ?? 'Request failed (${res.statusCode}).').toString(),
        code: json['code']?.toString(),
      );
    }
    return json;
  }

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on ApiException {
      rethrow;
    } on SocketException {
      throw ApiException('No connection to the server. Check your network, or the API address in Settings.');
    } on HttpException {
      throw ApiException('The server could not be reached.');
    } catch (e) {
      if (e.toString().contains('TimeoutException')) {
        throw ApiException('That took too long. Please try again.');
      }
      throw ApiException('Something went wrong. Please try again.');
    }
  }

  /// Resolve a pasted link into its downloadable formats.
  Future<ResolvedMedia> resolve(String url) => _guard(() async {
        final res = await _client
            .post(_uri('/api/resolve'),
                headers: {'content-type': 'application/json'}, body: jsonEncode({'url': url}))
            .timeout(AppConfig.timeout);
        final json = _decode(res);
        return ResolvedMedia.fromJson(json['data'] as Map<String, dynamic>);
      });

  /// The live catalogue — hides anything an admin switched off.
  Future<({List<Platform> platforms, List<RemoteTool> tools})> services() => _guard(() async {
        final res = await _client.get(_uri('/api/services')).timeout(AppConfig.timeout);
        final data = _decode(res)['data'] as Map<String, dynamic>;
        return (
          platforms: ((data['platforms'] as List?) ?? [])
              .whereType<Map<String, dynamic>>()
              .map(Platform.fromJson)
              .toList(),
          tools: ((data['tools'] as List?) ?? [])
              .whereType<Map<String, dynamic>>()
              .map(RemoteTool.fromJson)
              .toList(),
        );
      });

  Future<List<BlogPost>> posts({int limit = 20}) => _guard(() async {
        final res = await _client
            .get(_uri('/api/blog', {'limit': '$limit'}))
            .timeout(AppConfig.timeout);
        final data = _decode(res)['data'] as List;
        return data.whereType<Map<String, dynamic>>().map(BlogPost.fromJson).toList();
      });

  Future<BlogPost> post(String slug) => _guard(() async {
        final res = await _client.get(_uri('/api/blog', {'slug': slug})).timeout(AppConfig.timeout);
        return BlogPost.fromJson(_decode(res)['data'] as Map<String, dynamic>);
      });

  Future<void> contact({
    required String name,
    required String email,
    required String subject,
    required String message,
  }) =>
      _guard(() async {
        final res = await _client
            .post(_uri('/api/contact'),
                headers: {'content-type': 'application/json'},
                body: jsonEncode({'name': name, 'email': email, 'subject': subject, 'message': message}))
            .timeout(AppConfig.timeout);
        _decode(res);
      });

  Future<void> subscribe(String email) => _guard(() async {
        final res = await _client
            .post(_uri('/api/subscribe'),
                headers: {'content-type': 'application/json'}, body: jsonEncode({'email': email}))
            .timeout(AppConfig.timeout);
        _decode(res);
      });

  /// Builds the proxied download URL for a chosen format.
  Uri downloadUri(ResolvedMedia media, MediaFormat format) => _uri('/api/download', {
        'url': format.url,
        'title': media.title,
        'ext': format.ext,
        'quality': format.quality,
        'kind': format.kind,
        'platform': media.platform,
        'source': media.sourceUrl,
      });

  /// Streams a format to [file], reporting 0..1 progress. Returns the byte count.
  Future<int> downloadTo(
    ResolvedMedia media,
    MediaFormat format,
    File file, {
    void Function(double progress, int received, int total)? onProgress,
    bool Function()? isCancelled,
  }) =>
      _guard(() async {
        final request = http.Request('GET', downloadUri(media, format));
        final response = await _client.send(request).timeout(AppConfig.timeout);

        if (response.statusCode >= 400) {
          throw ApiException(
            response.statusCode == 503
                ? 'That downloader is temporarily unavailable.'
                : 'The media link expired. Resolve the URL again.',
          );
        }

        final total = response.contentLength ?? 0;
        final sink = file.openWrite();
        var received = 0;

        try {
          await for (final chunk in response.stream) {
            if (isCancelled?.call() == true) {
              await sink.close();
              await file.delete().catchError((_) => file);
              throw ApiException('Download cancelled.');
            }
            sink.add(chunk);
            received += chunk.length;
            if (total > 0) onProgress?.call(received / total, received, total);
          }
          await sink.flush();
        } finally {
          await sink.close();
        }
        return received;
      });

  /// Fire-and-forget analytics for the offline tools.
  Future<void> trackTool(String slug, {int files = 1, int? bytesIn, int? bytesOut}) async {
    try {
      await _client
          .post(_uri('/api/tools/track'),
              headers: {'content-type': 'application/json'},
              body: jsonEncode({
                'tool': slug,
                'files': files,
                if (bytesIn != null) 'bytesIn': bytesIn,
                if (bytesOut != null) 'bytesOut': bytesOut,
              }))
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      // analytics must never interrupt what the user just did
    }
  }
}
