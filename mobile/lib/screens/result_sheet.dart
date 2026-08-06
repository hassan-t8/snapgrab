import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/downloads.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class ResultSheet extends StatefulWidget {
  const ResultSheet({super.key, required this.media});
  final ResolvedMedia media;

  @override
  State<ResultSheet> createState() => _ResultSheetState();
}

class _ResultSheetState extends State<ResultSheet> {
  /// Formats the user has already tapped, so the row can show a spinner
  /// instead of looking like nothing happened.
  final _starting = <String>{};

  ResolvedMedia get media => widget.media;

  @override
  Widget build(BuildContext context) {
    final videos = media.formats.where((f) => f.kind == 'video').toList();
    final audios = media.formats.where((f) => f.kind == 'audio').toList();
    final images = media.formats.where((f) => f.kind == 'image').toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.82,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Container(
        decoration: BoxDecoration(
          color: context.scheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border.all(color: context.c.line),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(color: context.c.line, borderRadius: BorderRadius.circular(3)),
            ),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
                children: [
                  if (media.demo) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: context.c.warning.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.science_rounded, size: 17, color: context.c.warning),
                          const SizedBox(width: 9),
                          Expanded(
                            child: Text(
                              'Demo mode — the server has no RapidAPI key, so this is sample media.',
                              style: TextStyle(color: context.c.warning, fontSize: 12, height: 1.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  _preview(context),
                  const SizedBox(height: 18),
                  if (videos.isNotEmpty) ...[
                    _groupLabel(context, 'Video', Icons.movie_rounded, videos.length),
                    const SizedBox(height: 10),
                    ...staggered([for (final f in videos) _formatTile(context, f)]),
                    const SizedBox(height: 18),
                  ],
                  if (audios.isNotEmpty) ...[
                    _groupLabel(context, 'Audio', Icons.music_note_rounded, audios.length),
                    const SizedBox(height: 10),
                    ...staggered([for (final f in audios) _formatTile(context, f)]),
                    const SizedBox(height: 18),
                  ],
                  if (images.isNotEmpty) ...[
                    _groupLabel(context, 'Images', Icons.image_rounded, images.length),
                    const SizedBox(height: 10),
                    ...staggered([for (final f in images) _formatTile(context, f)]),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _preview(BuildContext context) {
    final duration = formatDuration(media.durationSec);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            children: [
              Container(
                width: 116,
                height: 78,
                color: context.c.soft,
                child: media.thumbnail == null
                    ? Icon(Icons.movie_rounded, color: context.c.muted)
                    : Image.network(media.thumbnail!, fit: BoxFit.cover,
                        errorBuilder: (context, error, stack) =>
                            Icon(Icons.movie_rounded, color: context.c.muted)),
              ),
              if (duration.isNotEmpty)
                Positioned(
                  right: 5,
                  bottom: 5,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(6)),
                    child: Text(duration,
                        style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700)),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Pill(label: media.platformName, dense: true),
                  if (media.cached) ...[
                    const SizedBox(width: 6),
                    Pill(label: 'instant', color: Brand.accent500, dense: true, icon: Icons.bolt_rounded),
                  ],
                ],
              ),
              const SizedBox(height: 7),
              Text(media.title,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, height: 1.3)),
              if (media.author != null) ...[
                const SizedBox(height: 4),
                Text(media.author!, style: TextStyle(color: context.c.muted, fontSize: 12.5)),
              ],
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.share_rounded, size: 20),
          tooltip: 'Share link',
          onPressed: () => SharePlus.instance.share(ShareParams(uri: Uri.parse(media.sourceUrl))),
        ),
      ],
    );
  }

  Widget _groupLabel(BuildContext context, String label, IconData icon, int count) => Row(
        children: [
          Icon(icon, size: 15, color: context.c.muted),
          const SizedBox(width: 7),
          Text(label.toUpperCase(),
              style: TextStyle(
                  color: context.c.muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
          const SizedBox(width: 7),
          Text('$count', style: TextStyle(color: context.c.muted, fontSize: 11)),
        ],
      );

  Widget _formatTile(BuildContext context, MediaFormat f) {
    final color = f.isAudio ? Brand.accent500 : (f.isImage ? context.c.warning : Brand.brand500);
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Surface(
        padding: const EdgeInsets.all(11),
        onTap: _starting.contains(f.id)
            ? null
            : () async {
                setState(() => _starting.add(f.id));
                DownloadService.enqueue(media, f);
                // hold the spinner briefly so the tap visibly registers
                await Future<void>.delayed(const Duration(milliseconds: 550));
                if (!context.mounted) return;
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context)
                  ..clearSnackBars()
                  ..showSnackBar(SnackBar(
                    content: Text('Downloading ${f.quality} ${f.ext.toUpperCase()} — watch the bar below'),
                    duration: const Duration(seconds: 3),
                  ));
              },
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                f.isAudio ? Icons.audiotrack_rounded : (f.isImage ? Icons.image_rounded : Icons.videocam_rounded),
                color: color,
                size: 19,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(f.quality, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                  const SizedBox(height: 2),
                  Text(
                    [
                      f.ext.toUpperCase(),
                      if (f.sizeBytes != null) formatBytes(f.sizeBytes),
                      if (f.kind == 'video' && !f.hasAudio) 'no audio',
                    ].join(' · '),
                    style: TextStyle(color: context.c.muted, fontSize: 11.5, letterSpacing: 0.2),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(gradient: Brand.gradient, borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_starting.contains(f.id))
                    const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  else
                    const Icon(Icons.download_rounded, size: 15, color: Colors.white),
                  const SizedBox(width: 5),
                  Text(_starting.contains(f.id) ? 'Starting' : 'Save',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12.5)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
