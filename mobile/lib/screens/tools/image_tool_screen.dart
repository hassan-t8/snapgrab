import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api.dart';
import '../../core/downloads.dart';
import '../../core/image_tools.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

enum ImageToolMode { convert, compress, resize }

class _Job {
  _Job(this.file, this.name);
  final File file;
  final String name;
  ImageJobResult? result;
  String? error;
  bool working = false;
  File? savedFile;
}

class ImageToolScreen extends StatefulWidget {
  const ImageToolScreen({super.key, required this.mode, required this.slug, required this.title});

  final ImageToolMode mode;
  final String slug;
  final String title;

  @override
  State<ImageToolScreen> createState() => _ImageToolScreenState();
}

class _ImageToolScreenState extends State<ImageToolScreen> {
  final _jobs = <_Job>[];
  final _widthCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();

  ImageOutput _output = ImageOutput.jpg;
  double _quality = 85;
  bool _lockRatio = true;
  bool _busy = false;
  ({int width, int height})? _firstSize;

  @override
  void initState() {
    super.initState();
    if (widget.mode == ImageToolMode.compress) _quality = 75;
  }

  @override
  void dispose() {
    _widthCtrl.dispose();
    _heightCtrl.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    try {
      final picked = await ImagePicker().pickMultiImage(limit: 20);
      if (picked.isEmpty) return;
      for (final x in picked) {
        _jobs.add(_Job(File(x.path), x.name));
      }
      _firstSize = await ImageTools.dimensions(_jobs.first.file);
      if (_firstSize != null && _widthCtrl.text.isEmpty) {
        _widthCtrl.text = '${_firstSize!.width}';
        _heightCtrl.text = '${_firstSize!.height}';
      }
      if (mounted) setState(() {});
    } catch (e) {
      _toast('Could not open the picker. Check photo permissions in Settings.');
    }
  }

  void _onWidthChanged(String value) {
    if (!_lockRatio || _firstSize == null) return;
    final w = int.tryParse(value);
    if (w == null || w <= 0) return;
    _heightCtrl.text = '${(w / _firstSize!.width * _firstSize!.height).round()}';
  }

  void _onHeightChanged(String value) {
    if (!_lockRatio || _firstSize == null) return;
    final h = int.tryParse(value);
    if (h == null || h <= 0) return;
    _widthCtrl.text = '${(h / _firstSize!.height * _firstSize!.width).round()}';
  }

  Future<void> _run() async {
    if (_jobs.isEmpty || _busy) return;
    setState(() => _busy = true);

    var bytesIn = 0;
    var bytesOut = 0;

    for (final job in _jobs) {
      setState(() {
        job.working = true;
        job.error = null;
      });
      try {
        final result = await ImageTools.run(
          job.file,
          output: _output,
          quality: _quality.round(),
          width: widget.mode == ImageToolMode.resize ? int.tryParse(_widthCtrl.text) : null,
          height: widget.mode == ImageToolMode.resize && !_lockRatio ? int.tryParse(_heightCtrl.text) : null,
        );
        job.result = result;
        bytesIn += result.originalBytes;
        bytesOut += result.size;
      } catch (e) {
        job.error = e is FormatException ? e.message : 'Could not process this image.';
      } finally {
        job.working = false;
        if (mounted) setState(() {});
      }
    }

    if (mounted) setState(() => _busy = false);
    if (bytesOut > 0) {
      Api.instance.trackTool(widget.slug, files: _jobs.length, bytesIn: bytesIn, bytesOut: bytesOut);
    }
  }

  Future<void> _save(_Job job) async {
    if (job.result == null) return;
    try {
      final dir = await getApplicationDocumentsDirectory();
      final base = job.name.contains('.') ? job.name.substring(0, job.name.lastIndexOf('.')) : job.name;
      final file = File('${dir.path}/$base-snapgrab.${_output.ext}');
      await file.writeAsBytes(job.result!.bytes);
      job.savedFile = file;

      final inGallery = await DownloadService.saveToGallery(file, isVideo: false);
      if (!mounted) return;
      setState(() {});
      _toast(inGallery ? 'Saved to your gallery' : 'Saved to app files — use Share to move it');
    } catch (_) {
      _toast('Could not save that file.');
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final done = _jobs.where((j) => j.result != null).toList();
    final totalIn = done.fold<int>(0, (n, j) => n + j.result!.originalBytes);
    final totalOut = done.fold<int>(0, (n, j) => n + j.result!.size);
    final saving = totalIn == 0 ? 0.0 : (totalIn - totalOut) / totalIn;

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
        children: [
          _dropZone(),
          const SizedBox(height: 16),
          if (widget.mode != ImageToolMode.resize || true) _controls(),
          const SizedBox(height: 16),
          GradientButton(
            label: switch (widget.mode) {
              ImageToolMode.compress => 'Compress ${_jobs.length} image${_jobs.length == 1 ? '' : 's'}',
              ImageToolMode.resize => 'Resize ${_jobs.length} image${_jobs.length == 1 ? '' : 's'}',
              ImageToolMode.convert => 'Convert to ${_output.label}',
            },
            icon: Icons.auto_awesome_rounded,
            busy: _busy,
            onPressed: _jobs.isEmpty ? null : _run,
          ),
          if (done.isNotEmpty && totalIn > 0) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: context.c.success.withValues(alpha: 0.11),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.c.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle_rounded, size: 18, color: context.c.success),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${formatBytes(totalIn)} → ${formatBytes(totalOut)}'
                      '${saving > 0 ? ' · ${(saving * 100).round()}% smaller' : saving < 0 ? ' · ${(saving.abs() * 100).round()}% larger' : ''}',
                      style: TextStyle(color: context.c.success, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),
          ],
          const SizedBox(height: 18),
          ...staggered([for (final job in _jobs) _jobTile(job)]),
        ],
      ),
    );
  }

  Widget _dropZone() => Surface(
        radius: 22,
        onTap: _pick,
        padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 18),
        borderColor: Brand.brand400.withValues(alpha: 0.35),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(gradient: Brand.gradientBr, borderRadius: BorderRadius.circular(18)),
              child: const Icon(Icons.add_photo_alternate_rounded, color: Colors.white, size: 26),
            ),
            const SizedBox(height: 15),
            const Text('Choose images', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 5),
            Text(
              _jobs.isEmpty ? 'JPG, PNG, WEBP, HEIC — up to 20 at a time' : '${_jobs.length} selected · tap to add more',
              style: TextStyle(color: context.c.muted, fontSize: 12.5),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );

  Widget _controls() {
    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Output format', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
          const SizedBox(height: 9),
          Row(
            children: [
              for (final o in ImageTools.supportedOutputs)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() => _output = o),
                      child: AnimatedContainer(
                        duration: 200.ms,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          gradient: _output == o ? Brand.gradient : null,
                          color: _output == o ? null : context.c.soft,
                          borderRadius: BorderRadius.circular(13),
                          border: Border.all(color: _output == o ? Colors.transparent : context.c.line),
                        ),
                        child: Center(
                          child: Text(
                            o.label,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: _output == o ? Colors.white : context.c.muted,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          if (_output.lossy) ...[
            const SizedBox(height: 18),
            Row(
              children: [
                const Text('Quality', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                const Spacer(),
                Text('${_quality.round()}%',
                    style: const TextStyle(color: Brand.brand400, fontWeight: FontWeight.w800, fontSize: 13)),
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: Brand.brand500,
                thumbColor: Brand.brand500,
                inactiveTrackColor: context.c.soft,
                trackHeight: 4,
              ),
              child: Slider(
                value: _quality,
                min: 10,
                max: 100,
                onChanged: (v) => setState(() => _quality = v),
              ),
            ),
            Text(
              _quality >= 90
                  ? 'Near-original detail, larger file.'
                  : _quality >= 70
                      ? 'The sweet spot for most photos.'
                      : 'Small files, visible artefacts in gradients.',
              style: TextStyle(color: context.c.muted, fontSize: 11.5),
            ),
          ],
          if (widget.mode == ImageToolMode.resize) ...[
            const SizedBox(height: 18),
            const Text('Dimensions (pixels)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
            const SizedBox(height: 9),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _widthCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: _onWidthChanged,
                    decoration: const InputDecoration(labelText: 'Width', isDense: true),
                  ),
                ),
                IconButton(
                  onPressed: () => setState(() => _lockRatio = !_lockRatio),
                  icon: Icon(_lockRatio ? Icons.link_rounded : Icons.link_off_rounded,
                      color: _lockRatio ? Brand.brand400 : context.c.muted),
                  tooltip: _lockRatio ? 'Aspect ratio locked' : 'Aspect ratio free',
                ),
                Expanded(
                  child: TextField(
                    controller: _heightCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: _onHeightChanged,
                    decoration: const InputDecoration(labelText: 'Height', isDense: true),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _jobTile(_Job job) {
    final result = job.result;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Surface(
        padding: const EdgeInsets.all(11),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(11),
              child: Image.file(job.file, width: 52, height: 52, fit: BoxFit.cover),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(job.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  const SizedBox(height: 3),
                  if (job.error != null)
                    Text(job.error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 11.5))
                  else if (result != null)
                    Row(
                      children: [
                        Text(formatBytes(result.originalBytes),
                            style: TextStyle(color: context.c.muted, fontSize: 11.5)),
                        Icon(Icons.arrow_right_alt_rounded, size: 15, color: context.c.muted),
                        Text(formatBytes(result.size),
                            style: TextStyle(color: context.c.success, fontWeight: FontWeight.w700, fontSize: 11.5)),
                        Text('  ${result.width}×${result.height}',
                            style: TextStyle(color: context.c.muted, fontSize: 11.5)),
                      ],
                    )
                  else
                    Text('Ready', style: TextStyle(color: context.c.muted, fontSize: 11.5)),
                ],
              ),
            ),
            if (job.working)
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2))
            else if (result != null) ...[
              IconButton(
                icon: Icon(job.savedFile != null ? Icons.check_circle_rounded : Icons.save_alt_rounded,
                    size: 20, color: job.savedFile != null ? context.c.success : null),
                tooltip: 'Save',
                onPressed: () => _save(job),
              ),
              IconButton(
                icon: const Icon(Icons.ios_share_rounded, size: 19),
                tooltip: 'Share',
                onPressed: () async {
                  if (job.savedFile == null) await _save(job);
                  if (job.savedFile != null) {
                    await SharePlus.instance.share(ShareParams(files: [XFile(job.savedFile!.path)]));
                  }
                },
              ),
            ] else
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 19),
                onPressed: () => setState(() => _jobs.remove(job)),
              ),
          ],
        ),
      ),
    );
  }
}
