import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/downloads.dart';
import '../core/theme.dart';

/// Persistent strip above the nav bar showing what is downloading right now.
/// Tapping it jumps to the Files tab.
class FloatingDownloadBar extends StatelessWidget {
  const FloatingDownloadBar({super.key, required this.onOpenFiles});

  final VoidCallback onOpenFiles;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<DownloadTask>>(
      valueListenable: DownloadService.tasks,
      builder: (context, tasks, _) {
        final active = tasks.where((t) => t.state == DownloadState.running).toList();
        final justFinished = tasks
            .where((t) => t.state == DownloadState.done && DateTime.now().difference(t.finishedAt ?? DateTime(2000)).inSeconds < 6)
            .toList();

        if (active.isEmpty && justFinished.isEmpty) return const SizedBox.shrink();

        final showingDone = active.isEmpty;
        final task = showingDone ? justFinished.first : active.first;
        final overall = active.isEmpty
            ? 1.0
            : active.map((t) => t.progress).reduce((a, b) => a + b) / active.length;

        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onOpenFiles,
              borderRadius: BorderRadius.circular(18),
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: context.scheme.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: showingDone ? context.c.success.withValues(alpha: 0.45) : Brand.brand500.withValues(alpha: 0.45),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: context.isDark ? 0.45 : 0.12),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 34,
                      height: 34,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          if (showingDone)
                            Icon(Icons.check_circle_rounded, color: context.c.success, size: 30)
                          else ...[
                            CircularProgressIndicator(
                              value: task.total > 0 ? task.progress : null,
                              strokeWidth: 2.6,
                              backgroundColor: context.c.soft,
                              valueColor: const AlwaysStoppedAnimation(Brand.brand400),
                            ),
                            Icon(Icons.download_rounded, size: 14, color: context.c.muted),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            showingDone
                                ? 'Download complete — tap to play'
                                : active.length == 1
                                    ? task.media.title
                                    : '${active.length} downloads in progress',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            showingDone
                                ? task.media.title
                                : task.total > 0
                                    ? '${(overall * 100).toStringAsFixed(0)}%  ·  ${formatBytes(task.received)} of ${formatBytes(task.total)}'
                                    : 'Starting…',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: context.c.muted, fontSize: 11.5),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (!showingDone)
                      GestureDetector(
                        onTap: task.cancel,
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Icon(Icons.close_rounded, size: 18, color: context.c.muted),
                        ),
                      )
                    else
                      Icon(Icons.play_circle_fill_rounded, color: context.c.success, size: 26),
                  ],
                ),
              ),
            ),
          ),
        )
            .animate()
            .fadeIn(duration: 260.ms)
            .slideY(begin: 0.5, end: 0, duration: 320.ms, curve: Curves.easeOutCubic);
      },
    );
  }
}
