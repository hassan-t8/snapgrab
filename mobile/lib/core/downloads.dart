import 'dart:io' as io;
import 'dart:io' show File, Directory;

import 'package:flutter/foundation.dart';
import 'package:image_gallery_saver_plus/image_gallery_saver_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api.dart';
import 'models.dart';
import 'notifications.dart';

enum DownloadState { queued, running, done, failed, cancelled }

class DownloadTask extends ChangeNotifier {
  DownloadTask({required this.media, required this.format}) : id = _nextId++;

  static int _nextId = 1;

  /// Also the notification id, so each download owns one shade entry.
  final int id;
  final ResolvedMedia media;
  final MediaFormat format;

  DownloadState state = DownloadState.queued;
  double progress = 0;
  int received = 0;
  int total = 0;
  String? error;
  String? savedPath;
  DateTime? finishedAt;
  bool inGallery = false;
  bool _cancelled = false;

  String get fileName => DownloadService.safeName(media.title, format);

  void cancel() {
    _cancelled = true;
    state = DownloadState.cancelled;
    Notifications.cancel(id);
    notifyListeners();
  }

  Future<void> start() async {
    state = DownloadState.running;
    notifyListeners();

    Notifications.showProgress(
      id: id,
      title: media.title,
      percent: 0,
      subtitle: 'Starting ${format.quality} ${format.ext.toUpperCase()}…',
    );

    var lastNotifiedPercent = -1;

    try {
      final dir = await DownloadService.targetDirectory();
      final file = File('${dir.path}/$fileName');

      await Api.instance.downloadTo(
        media,
        format,
        file,
        isCancelled: () => _cancelled,
        onProgress: (p, r, t) {
          progress = p;
          received = r;
          total = t;
          notifyListeners();

          // the shade only needs whole percents, not every chunk
          final percent = (p * 100).round();
          if (percent != lastNotifiedPercent && percent % 2 == 0) {
            lastNotifiedPercent = percent;
            Notifications.showProgress(
              id: id,
              title: media.title,
              percent: percent,
              subtitle: '$percent%  ·  ${formatBytes(r)} of ${formatBytes(t)}',
            );
          }
        },
      );

      savedPath = file.path;

      // put video and images where the user expects to find them
      if (!format.isAudio && (io.Platform.isAndroid || io.Platform.isIOS)) {
        inGallery = await DownloadService.saveToGallery(file, isVideo: !format.isImage);
      }

      state = DownloadState.done;
      progress = 1;
      finishedAt = DateTime.now();

      Notifications.showDone(
        id: id,
        title: 'Download complete',
        subtitle: '${media.title} — tap to play',
        filePath: savedPath,
      );
    } catch (e) {
      if (_cancelled) {
        state = DownloadState.cancelled;
        Notifications.cancel(id);
      } else {
        state = DownloadState.failed;
        error = e is ApiException ? e.message : 'The download failed. Please try again.';
        Notifications.showFailed(id: id, title: 'Download failed', reason: error!);
      }
    }
    notifyListeners();
  }
}

class DownloadService {
  DownloadService._();

  /// Keeps every task the user started this session, newest first.
  static final ValueNotifier<List<DownloadTask>> tasks = ValueNotifier<List<DownloadTask>>([]);

  static DownloadTask enqueue(ResolvedMedia media, MediaFormat format) {
    final task = DownloadTask(media: media, format: format);
    tasks.value = [task, ...tasks.value];
    // rebuild the floating bar on every progress tick
    task.addListener(() => tasks.value = List<DownloadTask>.of(tasks.value));
    task.start();
    return task;
  }

  /// True while any download is still running — drives the floating bar.
  static bool get hasActive => tasks.value.any((t) => t.state == DownloadState.running);

  static List<DownloadTask> get active =>
      tasks.value.where((t) => t.state == DownloadState.running).toList();

  static void clearFinished() {
    tasks.value = tasks.value.where((t) => t.state == DownloadState.running).toList();
  }

  static String safeName(String title, MediaFormat format) {
    final base = title
        .replaceAll(RegExp(r'[^\w\s.-]'), '')
        .replaceAll(RegExp(r'\s+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    final trimmed = base.isEmpty ? 'snapgrab' : (base.length > 60 ? base.substring(0, 60) : base);
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(8);
    return '$trimmed-$stamp.${format.ext}';
  }

  static Future<Directory> targetDirectory() async {
    if (io.Platform.isAndroid) {
      final dirs = await getExternalStorageDirectories(type: StorageDirectory.downloads);
      if (dirs != null && dirs.isNotEmpty) return dirs.first;
    }
    return getApplicationDocumentsDirectory();
  }

  /// Android 13+ splits media permissions; older versions still use storage.
  static Future<bool> ensurePermission() async {
    if (io.Platform.isIOS) {
      final status = await Permission.photosAddOnly.request();
      return status.isGranted || status.isLimited;
    }
    if (io.Platform.isAndroid) {
      final videos = await Permission.videos.request();
      if (videos.isGranted || videos.isLimited) return true;
      final storage = await Permission.storage.request();
      return storage.isGranted;
    }
    return true;
  }

  static Future<bool> saveToGallery(File file, {bool isVideo = true}) async {
    try {
      if (!await ensurePermission()) return false;
      final result = await ImageGallerySaverPlus.saveFile(file.path, isReturnPathOfIOS: true);
      if (result is Map) return result['isSuccess'] == true || result['filePath'] != null;
      return result != null;
    } catch (_) {
      return false;
    }
  }
}

String formatBytes(int? bytes) {
  if (bytes == null || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes.toDouble();
  var i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return '${value.toStringAsFixed(value >= 10 || i == 0 ? 0 : 1)} ${units[i]}';
}

String formatDuration(int? seconds) {
  if (seconds == null || seconds <= 0) return '';
  final d = Duration(seconds: seconds);
  final m = d.inMinutes.remainder(60).toString().padLeft(d.inHours > 0 ? 2 : 1, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
}
