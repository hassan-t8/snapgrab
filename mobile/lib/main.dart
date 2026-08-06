import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/theme.dart';
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

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadThemeMode();
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
        home: const RootShell(),
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
      bottomNavigationBar: Container(
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
    );
  }
}
