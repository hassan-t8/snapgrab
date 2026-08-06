import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:share_plus/share_plus.dart';

import '../core/downloads.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class DownloadsScreen extends StatelessWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your files'),
        actions: [
          ValueListenableBuilder(
            valueListenable: DownloadService.tasks,
            builder: (context, tasks, _) => tasks.isEmpty
                ? const SizedBox.shrink()
                : TextButton(
                    onPressed: DownloadService.clearFinished,
                    child: const Text('Clear', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
          ),
        ],
      ),
      body: ValueListenableBuilder<List<DownloadTask>>(
        valueListenable: DownloadService.tasks,
        builder: (context, tasks, _) {
          if (tasks.isEmpty) {
            return const EmptyState(
              icon: Icons.folder_open_rounded,
              title: 'Nothing downloaded yet',
              message: 'Paste a link on the Download tab and pick a quality — your files appear here.',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            itemCount: tasks.length,
            itemBuilder: (context, i) => _TaskTile(task: tasks[i])
                .animate()
                .fadeIn(duration: 320.ms, delay: (i * 40).ms)
                .slideY(begin: 0.08, end: 0),
          );
        },
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task});
  final DownloadTask task;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: task,
      builder: (context, _) {
        final running = task.state == DownloadState.running;
        final done = task.state == DownloadState.done;
        final failed = task.state == DownloadState.failed;

        final statusColor = done
            ? context.c.success
            : failed
                ? const Color(0xFFEF4444)
                : task.state == DownloadState.cancelled
                    ? context.c.muted
                    : Brand.brand400;

        return Padding(
          padding: const EdgeInsets.only(bottom: 11),
          child: Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Icon(
                        done
                            ? Icons.check_rounded
                            : failed
                                ? Icons.error_outline_rounded
                                : task.format.isAudio
                                    ? Icons.audiotrack_rounded
                                    : Icons.videocam_rounded,
                        color: statusColor,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(task.media.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          const SizedBox(height: 3),
                          Text(
                            [
                              task.media.platformName,
                              task.format.quality,
                              task.format.ext.toUpperCase(),
                              if (task.total > 0) formatBytes(task.total),
                            ].join(' · '),
                            style: TextStyle(color: context.c.muted, fontSize: 11.5),
                          ),
                        ],
                      ),
                    ),
                    if (running)
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 19),
                        tooltip: 'Cancel',
                        onPressed: task.cancel,
                      )
                    else if (done)
                      IconButton(
                        icon: const Icon(Icons.ios_share_rounded, size: 19),
                        tooltip: 'Share file',
                        onPressed: task.savedPath == null
                            ? null
                            : () => SharePlus.instance.share(
                                  ShareParams(files: [XFile(task.savedPath!)], text: task.media.title),
                                ),
                      ),
                  ],
                ),
                if (running) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      value: task.total > 0 ? task.progress : null,
                      minHeight: 6,
                      backgroundColor: context.c.soft,
                      valueColor: const AlwaysStoppedAnimation(Brand.brand500),
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    task.total > 0
                        ? '${(task.progress * 100).toStringAsFixed(0)}% · ${formatBytes(task.received)} of ${formatBytes(task.total)}'
                        : 'Downloading ${formatBytes(task.received)}…',
                    style: TextStyle(color: context.c.muted, fontSize: 11.5),
                  ),
                ],
                if (done) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Pill(
                        label: task.inGallery ? 'Saved to gallery' : 'Saved to app files',
                        color: context.c.success,
                        icon: Icons.check_circle_rounded,
                        dense: true,
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          task.savedPath == null ? '' : File(task.savedPath!).uri.pathSegments.last,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: context.c.muted, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ],
                if (failed && task.error != null) ...[
                  const SizedBox(height: 10),
                  Text(task.error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12, height: 1.4)),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
