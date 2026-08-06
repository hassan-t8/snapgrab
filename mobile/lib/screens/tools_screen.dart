import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../widgets/common.dart';
import 'tools/image_tool_screen.dart';
import 'tools/text_tool_screen.dart';

class ToolDef {
  const ToolDef({
    required this.slug,
    required this.name,
    required this.tagline,
    required this.icon,
    required this.color,
    required this.category,
    required this.builder,
  });

  final String slug;
  final String name;
  final String tagline;
  final IconData icon;
  final Color color;
  final String category;
  final Widget Function() builder;
}

final kTools = <ToolDef>[
  ToolDef(
    slug: 'image-converter',
    name: 'Image Converter',
    tagline: 'JPG and PNG, batch ready',
    icon: Icons.swap_horiz_rounded,
    color: Brand.brand500,
    category: 'Image',
    builder: () => const ImageToolScreen(mode: ImageToolMode.convert, slug: 'image-converter', title: 'Image Converter'),
  ),
  ToolDef(
    slug: 'image-compressor',
    name: 'Image Compressor',
    tagline: 'Shrink photos, keep detail',
    icon: Icons.compress_rounded,
    color: const Color(0xFFEF4444),
    category: 'Image',
    builder: () =>
        const ImageToolScreen(mode: ImageToolMode.compress, slug: 'image-compressor', title: 'Image Compressor'),
  ),
  ToolDef(
    slug: 'image-resizer',
    name: 'Image Resizer',
    tagline: 'Exact pixel dimensions',
    icon: Icons.photo_size_select_large_rounded,
    color: Brand.accent600,
    category: 'Image',
    builder: () => const ImageToolScreen(mode: ImageToolMode.resize, slug: 'image-resizer', title: 'Image Resizer'),
  ),
  ToolDef(
    slug: 'word-counter',
    name: 'Word Counter',
    tagline: 'Live counts and reading time',
    icon: Icons.text_fields_rounded,
    color: Brand.accent500,
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.count, slug: 'word-counter', title: 'Word Counter'),
  ),
  ToolDef(
    slug: 'case-converter',
    name: 'Case Converter',
    tagline: 'Nine cases at once',
    icon: Icons.abc_rounded,
    color: Brand.brand500,
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.caseConvert, slug: 'case-converter', title: 'Case Converter'),
  ),
  ToolDef(
    slug: 'json-formatter',
    name: 'JSON Formatter',
    tagline: 'Prettify, minify, validate',
    icon: Icons.data_object_rounded,
    color: const Color(0xFFF59E0B),
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.json, slug: 'json-formatter', title: 'JSON Formatter'),
  ),
  ToolDef(
    slug: 'base64-encoder',
    name: 'Base64 Encoder',
    tagline: 'Encode and decode text',
    icon: Icons.lock_outline_rounded,
    color: Brand.accent600,
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.base64, slug: 'base64-encoder', title: 'Base64 Encoder'),
  ),
  ToolDef(
    slug: 'url-encoder',
    name: 'URL Encoder',
    tagline: 'Percent encoding both ways',
    icon: Icons.link_rounded,
    color: Brand.brand400,
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.url, slug: 'url-encoder', title: 'URL Encoder'),
  ),
  ToolDef(
    slug: 'hash-generator',
    name: 'Hash Generator',
    tagline: 'SHA-1 to SHA-512',
    icon: Icons.tag_rounded,
    color: const Color(0xFFEF4444),
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.hash, slug: 'hash-generator', title: 'Hash Generator'),
  ),
  ToolDef(
    slug: 'slug-generator',
    name: 'Slug Generator',
    tagline: 'SEO friendly permalinks',
    icon: Icons.short_text_rounded,
    color: Brand.accent600,
    category: 'Text',
    builder: () => const TextToolScreen(mode: TextToolMode.slug, slug: 'slug-generator', title: 'Slug Generator'),
  ),
  ToolDef(
    slug: 'password-generator',
    name: 'Password Generator',
    tagline: 'Strong and random',
    icon: Icons.password_rounded,
    color: const Color(0xFFEF4444),
    category: 'Generators',
    builder: () =>
        const TextToolScreen(mode: TextToolMode.password, slug: 'password-generator', title: 'Password Generator'),
  ),
  ToolDef(
    slug: 'uuid-generator',
    name: 'UUID Generator',
    tagline: 'Version 4, in bulk',
    icon: Icons.fingerprint_rounded,
    color: Brand.brand500,
    category: 'Generators',
    builder: () => const TextToolScreen(mode: TextToolMode.uuid, slug: 'uuid-generator', title: 'UUID Generator'),
  ),
  ToolDef(
    slug: 'lorem-ipsum-generator',
    name: 'Lorem Ipsum',
    tagline: 'Placeholder text',
    icon: Icons.notes_rounded,
    color: Brand.brand400,
    category: 'Generators',
    builder: () =>
        const TextToolScreen(mode: TextToolMode.lorem, slug: 'lorem-ipsum-generator', title: 'Lorem Ipsum'),
  ),
];

class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final categories = <String>{for (final t in kTools) t.category}.toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Tools')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 4, 18, 28),
        children: [
          Surface(
            color: Brand.accent500.withValues(alpha: 0.08),
            borderColor: Brand.accent500.withValues(alpha: 0.28),
            child: Row(
              children: [
                Icon(Icons.shield_outlined, color: context.c.success, size: 19),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    'Every tool here runs on your device. Nothing is uploaded — they work offline too.',
                    style: TextStyle(color: context.c.muted, fontSize: 12.5, height: 1.45),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          for (final category in categories) ...[
            SectionHeader(
              title: '$category tools',
              subtitle: '${kTools.where((t) => t.category == category).length} available',
            ),
            const SizedBox(height: 13),
            ...staggered([
              for (final tool in kTools.where((t) => t.category == category))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Surface(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => tool.builder()),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: tool.color.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(tool.icon, color: tool.color, size: 21),
                        ),
                        const SizedBox(width: 13),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(tool.name,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                              const SizedBox(height: 3),
                              Text(tool.tagline,
                                  style: TextStyle(color: context.c.muted, fontSize: 12.5)),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded, color: context.c.muted),
                      ],
                    ),
                  ),
                ),
            ]),
            const SizedBox(height: 18),
          ],
        ],
      ),
    );
  }
}
