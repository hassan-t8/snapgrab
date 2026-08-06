import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';

import '../core/downloads.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

/// Plays a file the user downloaded. Handles audio too — the same decoder
/// works, it just has nothing to draw, so we show artwork instead.
class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key, required this.path, required this.title, this.isAudio = false});

  final String path;
  final String title;
  final bool isAudio;

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  VideoPlayerController? _controller;
  bool _ready = false;
  String? _error;
  bool _controlsVisible = true;

  @override
  void initState() {
    super.initState();
    _open();
  }

  Future<void> _open() async {
    final file = File(widget.path);
    if (!await file.exists()) {
      setState(() => _error = 'That file is no longer on this device.');
      return;
    }
    try {
      final controller = VideoPlayerController.file(file);
      await controller.initialize();
      if (!mounted) return;
      controller.addListener(() {
        if (mounted) setState(() {});
      });
      setState(() {
        _controller = controller;
        _ready = true;
      });
      await controller.play();
    } catch (e) {
      if (mounted) setState(() => _error = 'This file cannot be played in the app.');
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp, DeviceOrientation.portraitDown]);
    super.dispose();
  }

  void _togglePlay() {
    final c = _controller;
    if (c == null) return;
    c.value.isPlaying ? c.pause() : c.play();
  }

  void _seekBy(int seconds) {
    final c = _controller;
    if (c == null) return;
    final target = c.value.position + Duration(seconds: seconds);
    c.seekTo(target < Duration.zero ? Duration.zero : (target > c.value.duration ? c.value.duration : target));
  }

  String _clock(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(d.inHours > 0 ? 2 : 1, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    final position = c?.value.position ?? Duration.zero;
    final duration = c?.value.duration ?? Duration.zero;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15)),
        actions: [
          IconButton(
            icon: const Icon(Icons.ios_share_rounded, size: 20),
            tooltip: 'Share file',
            onPressed: () => SharePlus.instance.share(ShareParams(files: [XFile(widget.path)], text: widget.title)),
          ),
        ],
      ),
      body: _error != null
          ? EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Cannot play this file',
              message: _error,
              action: OutlinedButton.icon(
                onPressed: () => SharePlus.instance.share(ShareParams(files: [XFile(widget.path)])),
                icon: const Icon(Icons.ios_share_rounded, size: 17),
                label: const Text('Open in another app'),
              ),
            )
          : !_ready
              ? const Center(child: CircularProgressIndicator(color: Brand.brand400))
              : Column(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _controlsVisible = !_controlsVisible),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Center(
                              child: widget.isAudio || c!.value.size.height == 0
                                  ? _audioArtwork()
                                  : AspectRatio(
                                      aspectRatio: c.value.aspectRatio,
                                      child: VideoPlayer(c),
                                    ),
                            ),
                            AnimatedOpacity(
                              opacity: _controlsVisible ? 1 : 0,
                              duration: const Duration(milliseconds: 220),
                              child: IgnorePointer(
                                ignoring: !_controlsVisible,
                                child: Container(
                                  color: Colors.black26,
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      _roundButton(Icons.replay_10_rounded, () => _seekBy(-10), 26),
                                      const SizedBox(width: 26),
                                      _roundButton(
                                        c!.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                        _togglePlay,
                                        38,
                                        filled: true,
                                      ),
                                      const SizedBox(width: 26),
                                      _roundButton(Icons.forward_10_rounded, () => _seekBy(10), 26),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 22),
                      child: Column(
                        children: [
                          SliderTheme(
                            data: SliderTheme.of(context).copyWith(
                              trackHeight: 3,
                              activeTrackColor: Brand.brand400,
                              inactiveTrackColor: Colors.white24,
                              thumbColor: Brand.brand400,
                              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                              overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                            ),
                            child: Slider(
                              value: position.inMilliseconds
                                  .clamp(0, duration.inMilliseconds == 0 ? 1 : duration.inMilliseconds)
                                  .toDouble(),
                              max: (duration.inMilliseconds == 0 ? 1 : duration.inMilliseconds).toDouble(),
                              onChanged: (v) => c.seekTo(Duration(milliseconds: v.round())),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(_clock(position), style: const TextStyle(color: Colors.white70, fontSize: 12)),
                                Text(
                                  '${formatBytes(File(widget.path).existsSync() ? File(widget.path).lengthSync() : 0)}  ·  ${_clock(duration)}',
                                  style: const TextStyle(color: Colors.white70, fontSize: 12),
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

  Widget _audioArtwork() => Container(
        width: 190,
        height: 190,
        decoration: BoxDecoration(
          gradient: Brand.gradientBr,
          borderRadius: BorderRadius.circular(32),
          boxShadow: [BoxShadow(color: Brand.brand500.withValues(alpha: 0.4), blurRadius: 50, spreadRadius: 4)],
        ),
        child: const Icon(Icons.music_note_rounded, color: Colors.white, size: 76),
      );

  Widget _roundButton(IconData icon, VoidCallback onTap, double size, {bool filled = false}) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.all(filled ? 16 : 12),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: filled ? Brand.gradientBr : null,
            color: filled ? null : Colors.black38,
          ),
          child: Icon(icon, color: Colors.white, size: size),
        ),
      );
}
