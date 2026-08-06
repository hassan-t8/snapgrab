import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/platforms.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'result_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  LocalPlatform? _detected;
  bool _loading = false;
  String? _error;
  ResolvedMedia? _result;
  bool _clipboardOffered = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller.addListener(_onChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _offerClipboard());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // coming back from another app is exactly when a fresh link is on the clipboard
    if (state == AppLifecycleState.resumed) {
      _clipboardOffered = false;
      _offerClipboard();
    }
  }

  void _onChanged() {
    final next = detectPlatform(_controller.text);
    if (next?.id != _detected?.id) setState(() => _detected = next);
  }

  Future<void> _offerClipboard() async {
    if (_clipboardOffered || _controller.text.isNotEmpty || _loading) return;
    _clipboardOffered = true;
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text?.trim();
      if (text == null || text.isEmpty || !looksLikeLink(text)) return;
      if (detectPlatform(text) == null) return;
      if (!mounted) return;
      _controller.text = text;
      await _resolve();
    } catch (_) {
      // clipboard access can be denied — pasting manually still works
    }
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (text == null || text.isEmpty) {
      _toast('Your clipboard is empty.');
      return;
    }
    _controller.text = text;
    await _resolve();
  }

  Future<void> _resolve() async {
    final raw = _controller.text.trim();
    final clean = normalizeUrl(raw);
    if (clean == null) {
      setState(() => _error = 'That does not look like a valid link.');
      return;
    }
    FocusScope.of(context).unfocus();

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final media = await Api.instance.resolve(clean);
      if (!mounted) return;
      setState(() {
        _result = media;
        _loading = false;
      });
      _showResult(media);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  void _showResult(ResolvedMedia media) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ResultSheet(media: media),
    );
  }

  void _clear() {
    setState(() {
      _controller.clear();
      _result = null;
      _error = null;
      _detected = null;
    });
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            const Positioned(top: -40, left: 0, right: 0, child: AuroraBackground(height: 360)),
            ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
              children: [
                _header(),
                const SizedBox(height: 26),
                _hero(),
                const SizedBox(height: 22),
                _inputCard(),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  ErrorBanner(message: _error!, onRetry: _resolve),
                ],
                if (_result != null && !_loading) ...[
                  const SizedBox(height: 14),
                  _lastResultCard(),
                ],
                const SizedBox(height: 30),
                _supportedStrip(),
                const SizedBox(height: 28),
                _steps(),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() => Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: Brand.gradientBr,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: Brand.brand500.withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
            ),
            child: const Icon(Icons.download_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 11),
          RichText(
            text: TextSpan(
              style: context.text.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
              children: [
                const TextSpan(text: 'Snap'),
                TextSpan(text: 'Grab', style: const TextStyle(color: Brand.accent500)),
              ],
            ),
          ),
        ],
      ).animate().fadeIn(duration: 400.ms);

  Widget _hero() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Download any video.',
            style: context.text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, height: 1.1, letterSpacing: -1),
          ),
          const SizedBox(height: 2),
          ShaderMask(
            shaderCallback: (r) => Brand.gradient.createShader(r),
            child: Text(
              'Just paste the link.',
              style: context.text.headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w800, height: 1.1, letterSpacing: -1, color: Colors.white),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'YouTube, Instagram, TikTok, Facebook and ten more — original quality, no watermark.',
            style: TextStyle(color: context.c.muted, fontSize: 14.5, height: 1.55),
          ),
        ],
      ).animate().fadeIn(duration: 500.ms, delay: 80.ms).slideY(begin: 0.1, end: 0);

  Widget _inputCard() {
    return Surface(
      radius: 24,
      padding: const EdgeInsets.all(14),
      borderColor: _detected?.color.withValues(alpha: 0.5),
      child: Column(
        children: [
          TextField(
            controller: _controller,
            focusNode: _focus,
            keyboardType: TextInputType.url,
            textInputAction: TextInputAction.go,
            onSubmitted: (_) => _resolve(),
            autocorrect: false,
            style: const TextStyle(fontSize: 15),
            decoration: InputDecoration(
              hintText: 'Paste a video link…',
              prefixIcon: const Icon(Icons.link_rounded, size: 21),
              suffixIcon: _controller.text.isEmpty
                  ? IconButton(
                      icon: const Icon(Icons.content_paste_rounded, size: 20),
                      tooltip: 'Paste',
                      onPressed: _pasteFromClipboard,
                    )
                  : IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      tooltip: 'Clear',
                      onPressed: _clear,
                    ),
            ),
          ),
          AnimatedSize(
            duration: 220.ms,
            curve: Curves.easeOut,
            child: _detected == null
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Row(
                      children: [
                        Pill(label: '${_detected!.name} detected', color: _detected!.color, icon: Icons.check_circle),
                        const Spacer(),
                      ],
                    ).animate().fadeIn(duration: 240.ms).slideX(begin: -0.05, end: 0),
                  ),
          ),
          const SizedBox(height: 12),
          GradientButton(
            label: _loading ? 'Reading link…' : 'Download',
            icon: Icons.download_rounded,
            busy: _loading,
            onPressed: _controller.text.trim().isEmpty ? null : _resolve,
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.bolt_rounded, size: 14, color: context.c.muted),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  'Copy a link in any app — it is detected when you return',
                  style: TextStyle(color: context.c.muted, fontSize: 11.5),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(duration: 500.ms, delay: 160.ms).slideY(begin: 0.08, end: 0);
  }

  Widget _lastResultCard() {
    final media = _result!;
    return Surface(
      onTap: () => _showResult(media),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 62,
              height: 62,
              color: context.c.soft,
              child: media.thumbnail == null
                  ? Icon(Icons.movie_rounded, color: context.c.muted)
                  : Image.network(media.thumbnail!, fit: BoxFit.cover,
                      errorBuilder: (context, error, stack) =>
                          Icon(Icons.movie_rounded, color: context.c.muted)),
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(media.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, height: 1.3)),
                const SizedBox(height: 5),
                Text('${media.platformName} · ${media.formats.length} formats',
                    style: TextStyle(color: context.c.muted, fontSize: 12)),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: context.c.muted),
        ],
      ),
    ).animate().fadeIn(duration: 320.ms);
  }

  Widget _supportedStrip() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Supported platforms', subtitle: 'Paste a link from any of these'),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in kPlatforms)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: context.scheme.surface,
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: context.c.line),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: p.color, shape: BoxShape.circle)),
                    const SizedBox(width: 7),
                    Text(p.name, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
          ],
        ),
      ],
    ).animate().fadeIn(duration: 500.ms, delay: 240.ms);
  }

  Widget _steps() {
    const steps = [
      ('Copy the link', 'Use Share or Copy link in any app.'),
      ('Open SnapGrab', 'The link is picked up automatically.'),
      ('Pick a quality', 'Every stream the source published.'),
      ('Save', 'Videos land straight in your gallery.'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'How it works'),
        const SizedBox(height: 14),
        ...staggered([
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Surface(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: Brand.brand500.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Text('${i + 1}',
                            style: const TextStyle(color: Brand.brand400, fontWeight: FontWeight.w800, fontSize: 13)),
                      ),
                    ),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(steps[i].$1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          const SizedBox(height: 3),
                          Text(steps[i].$2,
                              style: TextStyle(color: context.c.muted, fontSize: 12.8, height: 1.45)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ]),
      ],
    );
  }
}
