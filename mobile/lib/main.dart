import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/downloads.dart';
import 'core/notifications.dart';
import 'core/prefs.dart';
import 'core/theme.dart';
import 'screens/player_screen.dart';
import 'screens/splash_screen.dart';
import 'widgets/download_bar.dart';
import 'screens/blog_screen.dart';
import 'screens/downloads_screen.dart';
import 'screens/home_screen.dart';
import 'screens/more_screen.dart';
import 'screens/tools_screen.dart';

final ValueNotifier<ThemeMode> themeMode = ValueNotifier(ThemeMode.dark);

const _themeKey = 'sg_theme_mode';

Future<void> loadThemeMode() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_themeKey);
    themeMode.value = switch (saved) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark,
    };
  } catch (_) {
    // a missing preference is not worth failing startup over
  }
}

Future<void> saveThemeMode(ThemeMode mode) async {
  themeMode.value = mode;
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, mode.name);
  } catch (_) {}
}

final navigatorKey = GlobalKey<NavigatorState>();

/// Whether onboarding had already been completed when this launch began.
/// Onboarding asks for notification permission itself, so returning users are
/// the only ones the shell needs to prompt.
bool _returningUser = false;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Prefs.init();
  _returningUser = Prefs.hasOnboarded;
  await loadThemeMode();
  await Notifications.init();

  // the Cancel button on a progress notification stops that download
  Notifications.onCancelTask = DownloadService.cancelById;

  // tapping the body, or the Play button, opens the file in the player
  Notifications.onOpenFile = (path) {
    final name = path.split('/').last;
    // prefer the real title over the on-disk filename when we still have the task
    final matches = DownloadService.tasks.value.where((t) => t.savedPath == path);
    final task = matches.isEmpty ? null : matches.first;

    navigatorKey.currentState?.push(
      MaterialPageRoute(
        builder: (_) => PlayerScreen(
          path: path,
          title: task?.media.title ?? name,
          isAudio: task?.format.isAudio ??
              RegExp(r'\.(mp3|m4a|aac|opus|wav)$', caseSensitive: false).hasMatch(name),
        ),
      ),
    );
  };
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp, DeviceOrientation.portraitDown]);
  runApp(const SnapGrabApp());
}

class SnapGrabApp extends StatelessWidget {
  const SnapGrabApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeMode,
      builder: (context, mode, _) => MaterialApp(
        title: 'SnapGrab',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        home: const SplashScreen(),
      ),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;
  bool _askedForNotifications = false;

  @override
  void initState() {
    super.initState();
    // first-run users are asked at the end of onboarding, where it has context
    if (!_returningUser) return;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (_askedForNotifications) return;
      _askedForNotifications = true;
      await Notifications.requestPermission();
    });
  }

  void _openFiles() => setState(() => _index = 2);

  static const _tabs = [
    (icon: Icons.download_rounded, outline: Icons.download_outlined, label: 'Download'),
    (icon: Icons.grid_view_rounded, outline: Icons.grid_view_outlined, label: 'Tools'),
    (icon: Icons.folder_rounded, outline: Icons.folder_outlined, label: 'Files'),
    (icon: Icons.article_rounded, outline: Icons.article_outlined, label: 'Blog'),
    (icon: Icons.more_horiz_rounded, outline: Icons.more_horiz, label: 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          HomeScreen(),
          ToolsScreen(),
          DownloadsScreen(),
          BlogScreen(),
          MoreScreen(),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingDownloadBar(onOpenFiles: _openFiles),
          Container(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: context.c.line)),
            ),
            child: NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                for (final t in _tabs)
                  NavigationDestination(
                    icon: Icon(t.outline),
                    selectedIcon: Icon(t.icon),
                    label: t.label,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
