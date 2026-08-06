import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/prefs.dart';
import '../core/theme.dart';
import '../main.dart';
import 'onboarding_screen.dart';

/// Branded splash that covers the first frame while the app settles, then
/// hands off to onboarding (first run only) or straight to the app.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _go();
  }

  Future<void> _go() async {
    // long enough for the mark to land, short enough not to feel like a wait
    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 450),
        pageBuilder: (context, animation, secondary) => Prefs.hasOnboarded ? const RootShell() : const OnboardingScreen(),
        transitionsBuilder: (context, animation, secondary, child) => FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Brand.darkBg,
      body: Stack(
        children: [
          // the same aurora the app uses, so the splash belongs to the product
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.4, -0.5),
                  radius: 1.3,
                  colors: [
                    Brand.brand500.withValues(alpha: 0.30),
                    Brand.accent500.withValues(alpha: 0.10),
                    Brand.darkBg,
                  ],
                  stops: const [0, 0.55, 1],
                ),
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    gradient: Brand.gradientBr,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(color: Brand.brand500.withValues(alpha: 0.55), blurRadius: 44, spreadRadius: 4),
                    ],
                  ),
                  child: const Icon(Icons.download_rounded, color: Colors.white, size: 48),
                )
                    .animate()
                    .scale(begin: const Offset(0.7, 0.7), end: const Offset(1, 1), duration: 620.ms, curve: Curves.easeOutBack)
                    .fadeIn(duration: 420.ms)
                    .then(delay: 120.ms)
                    .shimmer(duration: 900.ms, color: Colors.white.withValues(alpha: 0.35)),
                const SizedBox(height: 26),
                RichText(
                  text: const TextSpan(
                    style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -0.8, color: Colors.white),
                    children: [
                      TextSpan(text: 'Snap'),
                      TextSpan(text: 'Grab', style: TextStyle(color: Brand.accent400)),
                    ],
                  ),
                ).animate().fadeIn(delay: 260.ms, duration: 520.ms).slideY(begin: 0.35, end: 0, curve: Curves.easeOut),
                const SizedBox(height: 10),
                Text(
                  'Download anything. Just paste the link.',
                  style: TextStyle(color: Brand.darkMuted, fontSize: 13.5),
                ).animate().fadeIn(delay: 480.ms, duration: 520.ms),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 54,
            child: Center(
              child: SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  valueColor: AlwaysStoppedAnimation(Brand.brand400.withValues(alpha: 0.9)),
                ),
              ).animate().fadeIn(delay: 700.ms),
            ),
          ),
        ],
      ),
    );
  }
}
