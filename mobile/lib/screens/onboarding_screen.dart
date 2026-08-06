import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/notifications.dart';
import '../core/prefs.dart';
import '../core/theme.dart';
import '../main.dart';
import '../widgets/common.dart';

class _Slide {
  const _Slide({
    required this.icon,
    required this.title,
    required this.body,
    required this.color,
    required this.bullets,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color color;
  final List<String> bullets;
}

const _slides = <_Slide>[
  _Slide(
    icon: Icons.content_paste_go_rounded,
    color: Brand.brand500,
    title: 'Copy a link,\nwe do the rest',
    body: 'Copy from YouTube, Instagram, TikTok, Facebook and ten more. SnapGrab spots it the moment you open the app.',
    bullets: ['14 platforms supported', 'No account, no daily limit', 'Original quality, no watermark'],
  ),
  _Slide(
    icon: Icons.tune_rounded,
    color: Brand.accent500,
    title: 'Choose exactly\nwhat you want',
    body: 'Every stream the source published, from 4K down to 360p — plus audio-only when you just want the sound.',
    bullets: ['Up to 4K where available', 'MP3 and M4A audio', 'See the file size before you commit'],
  ),
  _Slide(
    icon: Icons.grid_view_rounded,
    color: Color(0xFFF59E0B),
    title: '13 tools that\nnever upload',
    body: 'Convert, compress and resize images, format JSON, hash text, generate passwords — all on your device.',
    bullets: ['Works with no connection', 'Your files never leave the phone', 'Batch ready'],
  ),
  _Slide(
    icon: Icons.notifications_active_rounded,
    color: Color(0xFFEF4444),
    title: 'Always know\nwhat is happening',
    body: 'Live progress in your notification shade, a floating bar in the app, and one tap to play what you saved.',
    bullets: ['Cancel from the notification', 'Play the moment it lands', 'Saved straight to your gallery'],
  ),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pages = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  bool get _isLast => _index == _slides.length - 1;

  Future<void> _finish() async {
    await Prefs.setOnboarded();
    // asking here means the prompt has context, instead of ambushing the splash
    await Notifications.requestPermission();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 420),
        pageBuilder: (context, animation, secondary) => const RootShell(),
        transitionsBuilder: (context, animation, secondary, child) => FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  void _next() {
    if (_isLast) {
      _finish();
    } else {
      _pages.nextPage(duration: const Duration(milliseconds: 380), curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_index];

    return Scaffold(
      body: Stack(
        children: [
          // the accent colour follows the slide, so progress is felt not just seen
          AnimatedContainer(
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeOut,
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(-0.5, -0.75),
                radius: 1.25,
                colors: [
                  slide.color.withValues(alpha: context.isDark ? 0.28 : 0.16),
                  context.scheme.surface.withValues(alpha: 0),
                ],
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(0, 8, 12, 0),
                    child: TextButton(
                      onPressed: _finish,
                      child: Text('Skip', style: TextStyle(color: context.c.muted, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pages,
                    itemCount: _slides.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (context, i) => _SlideView(slide: _slides[i], key: ValueKey(i)),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 26),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < _slides.length; i++)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 280),
                              curve: Curves.easeOut,
                              margin: const EdgeInsets.symmetric(horizontal: 3.5),
                              height: 7,
                              width: i == _index ? 26 : 7,
                              decoration: BoxDecoration(
                                color: i == _index ? slide.color : context.c.line,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 22),
                      GradientButton(
                        label: _isLast ? 'Get started' : 'Next',
                        icon: _isLast ? Icons.rocket_launch_rounded : Icons.arrow_forward_rounded,
                        onPressed: _next,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Free · No signup · Nothing stored on our servers',
                        style: TextStyle(color: context.c.muted, fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({super.key, required this.slide});
  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: slide.color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: slide.color.withValues(alpha: 0.35)),
            ),
            child: Icon(slide.icon, size: 40, color: slide.color),
          )
              .animate()
              .fadeIn(duration: 420.ms)
              .scale(begin: const Offset(0.82, 0.82), end: const Offset(1, 1), curve: Curves.easeOutBack),
          const SizedBox(height: 30),
          Text(
            slide.title,
            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, height: 1.18, letterSpacing: -1),
          ).animate().fadeIn(delay: 90.ms, duration: 420.ms).slideY(begin: 0.16, end: 0, curve: Curves.easeOut),
          const SizedBox(height: 14),
          Text(
            slide.body,
            style: TextStyle(color: context.c.muted, fontSize: 15, height: 1.6),
          ).animate().fadeIn(delay: 170.ms, duration: 420.ms).slideY(begin: 0.16, end: 0, curve: Curves.easeOut),
          const SizedBox(height: 26),
          for (var i = 0; i < slide.bullets.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Icon(Icons.check_circle_rounded, size: 19, color: slide.color),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(slide.bullets[i],
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(delay: (260 + i * 90).ms, duration: 380.ms)
                .slideX(begin: 0.12, end: 0, curve: Curves.easeOut),
        ],
      ),
    );
  }
}
