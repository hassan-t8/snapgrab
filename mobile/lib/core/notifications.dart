import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Download notifications: a live progress bar in the shade while a file is
/// downloading, then a tappable "ready to play" notification when it lands.
class Notifications {
  Notifications._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  /// Set by the app so a notification tap can open the player.
  static void Function(String filePath)? onOpenFile;

  static const _progressChannel = AndroidNotificationChannel(
    'downloads_progress',
    'Download progress',
    description: 'Shows how far along a download is.',
    importance: Importance.low, // quiet: it updates many times a second
    showBadge: false,
  );

  static const _doneChannel = AndroidNotificationChannel(
    'downloads_done',
    'Finished downloads',
    description: 'Tells you when a file is ready to play.',
    importance: Importance.defaultImportance,
  );

  static Future<void> init() async {
    if (_ready) return;
    try {
      const settings = InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      );

      await _plugin.initialize(
        settings: settings,
        onDidReceiveNotificationResponse: (response) {
          final path = response.payload;
          if (path != null && path.isNotEmpty) onOpenFile?.call(path);
        },
      );

      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(_progressChannel);
      await android?.createNotificationChannel(_doneChannel);

      _ready = true;
    } catch (e) {
      debugPrint('notifications unavailable: $e');
    }
  }

  /// Android 13+ requires an explicit opt-in before anything is shown.
  static Future<bool> requestPermission() async {
    try {
      if (Platform.isAndroid) {
        final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
        return await android?.requestNotificationsPermission() ?? false;
      }
      final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
      return await ios?.requestPermissions(alert: true, badge: true, sound: true) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> showProgress({
    required int id,
    required String title,
    required int percent,
    required String subtitle,
  }) async {
    if (!_ready) return;
    try {
      await _plugin.show(
        id: id,
        title: title,
        body: subtitle,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            _progressChannel.id,
            _progressChannel.name,
            channelDescription: _progressChannel.description,
            importance: Importance.low,
            priority: Priority.low,
            onlyAlertOnce: true,
            ongoing: true,
            autoCancel: false,
            showProgress: true,
            maxProgress: 100,
            progress: percent.clamp(0, 100),
            indeterminate: percent < 0,
            category: AndroidNotificationCategory.progress,
          ),
          iOS: const DarwinNotificationDetails(presentAlert: false, presentSound: false),
        ),
      );
    } catch (_) {}
  }

  static Future<void> showDone({
    required int id,
    required String title,
    required String subtitle,
    String? filePath,
  }) async {
    if (!_ready) return;
    try {
      await _plugin.cancel(id: id);
      await _plugin.show(
        id: id,
        title: title,
        body: subtitle,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'downloads_done',
            'Finished downloads',
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
            autoCancel: true,
          ),
          iOS: DarwinNotificationDetails(),
        ),
        payload: filePath,
      );
    } catch (_) {}
  }

  static Future<void> showFailed({required int id, required String title, required String reason}) async {
    if (!_ready) return;
    try {
      await _plugin.cancel(id: id);
      await _plugin.show(
        id: id,
        title: title,
        body: reason,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'downloads_done',
            'Finished downloads',
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
            autoCancel: true,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    } catch (_) {}
  }

  static Future<void> cancel(int id) async {
    if (!_ready) return;
    try {
      await _plugin.cancel(id: id);
    } catch (_) {}
  }
}
