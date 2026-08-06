import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class BlogScreen extends StatefulWidget {
  const BlogScreen({super.key});

  @override
  State<BlogScreen> createState() => _BlogScreenState();
}

class _BlogScreenState extends State<BlogScreen> {
  late Future<List<BlogPost>> _future;

  @override
  void initState() {
    super.initState();
    _future = Api.instance.posts();
  }

  Future<void> _reload() async {
    setState(() => _future = Api.instance.posts());
    await _future.catchError((_) => <BlogPost>[]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Guides')),
      body: RefreshIndicator(
        onRefresh: _reload,
        color: Brand.brand500,
        child: FutureBuilder<List<BlogPost>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
                children: [
                  for (var i = 0; i < 4; i++)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 14),
                      child: Surface(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ShimmerBox(height: 150, radius: 14),
                            SizedBox(height: 12),
                            ShimmerBox(height: 15, width: 220),
                            SizedBox(height: 8),
                            ShimmerBox(height: 12),
                          ],
                        ),
                      ),
                    ),
                ],
              );
            }

            if (snap.hasError) {
              return ListView(
                padding: const EdgeInsets.all(18),
                children: [
                  ErrorBanner(message: snap.error.toString(), onRetry: _reload),
                  const SizedBox(height: 20),
                  Text(
                    'The app talks to ${AppConfig.apiBase}. Change it under More → Settings if your server lives elsewhere.',
                    style: TextStyle(color: context.c.muted, fontSize: 12.5, height: 1.5),
                  ),
                ],
              );
            }

            final posts = snap.data ?? [];
            if (posts.isEmpty) {
              return const EmptyState(
                icon: Icons.article_outlined,
                title: 'No guides yet',
                message: 'New articles will appear here as they are published.',
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
              itemCount: posts.length,
              itemBuilder: (context, i) => _postCard(posts[i], i),
            );
          },
        ),
      ),
    );
  }

  Widget _postCard(BlogPost post, int index) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Surface(
        padding: EdgeInsets.zero,
        radius: 20,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => BlogPostScreen(slug: post.slug, preview: post)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (post.cover != null)
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(19)),
                child: CachedNetworkImage(
                  imageUrl: post.cover!,
                  height: 158,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (context, url) => Container(height: 158, color: context.c.soft),
                  errorWidget: (context, url, error) => Container(
                    height: 158,
                    color: context.c.soft,
                    child: Icon(Icons.image_not_supported_outlined, color: context.c.muted),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (post.tags.isNotEmpty)
                    Wrap(
                      spacing: 6,
                      children: [for (final t in post.tags.take(2)) Pill(label: t, dense: true)],
                    ),
                  const SizedBox(height: 9),
                  Text(post.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, height: 1.3)),
                  const SizedBox(height: 7),
                  Text(post.excerpt,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: context.c.muted, fontSize: 13, height: 1.5)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.schedule_rounded, size: 13, color: context.c.muted),
                      const SizedBox(width: 5),
                      Text('${post.readingMinutes} min read',
                          style: TextStyle(color: context.c.muted, fontSize: 11.5)),
                      const Spacer(),
                      Text(_formatDate(post.createdAt),
                          style: TextStyle(color: context.c.muted, fontSize: 11.5)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms, delay: (index * 60).ms).slideY(begin: 0.08, end: 0);
  }
}

String _formatDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${d.day} ${months[d.month - 1]} ${d.year}';
}

class BlogPostScreen extends StatefulWidget {
  const BlogPostScreen({super.key, required this.slug, this.preview});
  final String slug;
  final BlogPost? preview;

  @override
  State<BlogPostScreen> createState() => _BlogPostScreenState();
}

class _BlogPostScreenState extends State<BlogPostScreen> {
  late Future<BlogPost> _future = Api.instance.post(widget.slug);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guide'),
        actions: [
          IconButton(
            icon: const Icon(Icons.ios_share_rounded, size: 20),
            onPressed: () => SharePlus.instance.share(
              ShareParams(uri: Uri.parse('${AppConfig.apiBase}/blog/${widget.slug}')),
            ),
          ),
        ],
      ),
      body: FutureBuilder<BlogPost>(
        future: _future,
        builder: (context, snap) {
          final post = snap.data ?? widget.preview;
          if (snap.hasError && post == null) {
            return Padding(
              padding: const EdgeInsets.all(18),
              child: ErrorBanner(
                message: snap.error.toString(),
                onRetry: () => setState(() => _future = Api.instance.post(widget.slug)),
              ),
            );
          }
          if (post == null) {
            return const Center(child: CircularProgressIndicator(color: Brand.brand500));
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
            children: [
              if (post.cover != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: CachedNetworkImage(imageUrl: post.cover!, height: 190, width: double.infinity, fit: BoxFit.cover),
                ),
              const SizedBox(height: 18),
              Text(post.title,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, height: 1.25, letterSpacing: -0.6)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(post.author, style: TextStyle(color: context.c.muted, fontSize: 12.5)),
                  Text('  ·  ', style: TextStyle(color: context.c.muted)),
                  Text(_formatDate(post.createdAt), style: TextStyle(color: context.c.muted, fontSize: 12.5)),
                  Text('  ·  ', style: TextStyle(color: context.c.muted)),
                  Text('${post.readingMinutes} min', style: TextStyle(color: context.c.muted, fontSize: 12.5)),
                ],
              ),
              const SizedBox(height: 8),
              Divider(color: context.c.line),
              const SizedBox(height: 12),
              if (post.content == null)
                const Center(child: Padding(padding: EdgeInsets.all(30), child: CircularProgressIndicator()))
              else
                ..._renderMarkdown(context, post.content!),
            ],
          );
        },
      ),
    );
  }
}

/// Minimal markdown rendering — the posts only use headings, lists, quotes and bold.
List<Widget> _renderMarkdown(BuildContext context, String md) {
  final widgets = <Widget>[];

  TextSpan inline(String text) {
    final spans = <TextSpan>[];
    final pattern = RegExp(r'\*\*(.+?)\*\*|`(.+?)`');
    var index = 0;
    for (final m in pattern.allMatches(text)) {
      if (m.start > index) spans.add(TextSpan(text: text.substring(index, m.start)));
      if (m[1] != null) {
        spans.add(TextSpan(text: m[1], style: const TextStyle(fontWeight: FontWeight.w800)));
      } else if (m[2] != null) {
        spans.add(TextSpan(
          text: m[2],
          style: TextStyle(fontFamily: 'monospace', backgroundColor: context.c.soft, fontSize: 13),
        ));
      }
      index = m.end;
    }
    if (index < text.length) spans.add(TextSpan(text: text.substring(index)));
    return TextSpan(children: spans);
  }

  for (final rawLine in md.split('\n')) {
    final line = rawLine.trimRight();
    if (line.trim().isEmpty) {
      widgets.add(const SizedBox(height: 6));
      continue;
    }

    final heading = RegExp(r'^(#{2,4})\s+(.*)$').firstMatch(line);
    if (heading != null) {
      widgets.add(Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 8),
        child: Text(heading[2]!,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: heading[1]!.length == 2 ? 19 : 16.5,
              height: 1.3,
              letterSpacing: -0.3,
            )),
      ));
      continue;
    }

    if (line.startsWith('>')) {
      widgets.add(Container(
        margin: const EdgeInsets.symmetric(vertical: 10),
        padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: Brand.brand500, width: 3)),
          color: context.c.soft,
          borderRadius: const BorderRadius.horizontal(right: Radius.circular(10)),
        ),
        child: Text.rich(inline(line.replaceFirst(RegExp(r'^>\s?'), '')),
            style: TextStyle(color: context.c.muted, fontSize: 14, fontStyle: FontStyle.italic, height: 1.6)),
      ));
      continue;
    }

    final bullet = RegExp(r'^[-*]\s+(.*)$').firstMatch(line);
    final numbered = RegExp(r'^(\d+)\.\s+(.*)$').firstMatch(line);
    if (bullet != null || numbered != null) {
      widgets.add(Padding(
        padding: const EdgeInsets.only(left: 4, top: 4, bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2, right: 10),
              child: numbered != null
                  ? Text('${numbered[1]}.',
                      style: const TextStyle(color: Brand.brand400, fontWeight: FontWeight.w800, fontSize: 13.5))
                  : const Icon(Icons.circle, size: 6, color: Brand.brand400),
            ),
            Expanded(
              child: Text.rich(inline(bullet?[1] ?? numbered![2]!),
                  style: TextStyle(color: context.c.muted, fontSize: 14.5, height: 1.65)),
            ),
          ],
        ),
      ));
      continue;
    }

    widgets.add(Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Text.rich(inline(line), style: TextStyle(color: context.c.muted, fontSize: 14.5, height: 1.7)),
    ));
  }

  return widgets;
}
