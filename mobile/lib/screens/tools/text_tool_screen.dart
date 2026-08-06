import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/api.dart';
import '../../core/text_tools.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

enum TextToolMode { count, caseConvert, json, base64, url, hash, slug, password, uuid, lorem }

class TextToolScreen extends StatefulWidget {
  const TextToolScreen({super.key, required this.mode, required this.slug, required this.title});

  final TextToolMode mode;
  final String slug;
  final String title;

  @override
  State<TextToolScreen> createState() => _TextToolScreenState();
}

class _TextToolScreenState extends State<TextToolScreen> {
  final _input = TextEditingController();

  bool _encode = true;

  // password
  double _length = 20;
  bool _useLower = true, _useUpper = true, _useDigits = true, _useSymbols = true, _avoidAmbiguous = false;
  String _password = '';

  // uuid
  int _count = 5;
  List<String> _uuids = [];

  // lorem
  String _unit = 'paragraphs';
  int _amount = 3;
  int _seed = 1;

  bool get _isGenerator =>
      widget.mode == TextToolMode.password || widget.mode == TextToolMode.uuid || widget.mode == TextToolMode.lorem;

  @override
  void initState() {
    super.initState();
    _input.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.mode == TextToolMode.password) _generatePassword();
      if (widget.mode == TextToolMode.uuid) _generateUuids();
    });
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  void _generatePassword() {
    setState(() {
      _password = Generators.password(
        length: _length.round(),
        useLower: _useLower,
        useUpper: _useUpper,
        useDigits: _useDigits,
        useSymbols: _useSymbols,
        avoidAmbiguous: _avoidAmbiguous,
      );
    });
  }

  void _generateUuids() {
    setState(() => _uuids = List.generate(_count, (_) => Generators.uuidV4()));
  }

  Future<void> _copy(String value, [String label = 'Copied']) async {
    await Clipboard.setData(ClipboardData(text: value));
    Api.instance.trackTool(widget.slug);
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(label), duration: const Duration(seconds: 2)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (!_isGenerator && _input.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              tooltip: 'Clear',
              onPressed: () => _input.clear(),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
        children: [
          if (!_isGenerator) ...[
            if (widget.mode == TextToolMode.base64 || widget.mode == TextToolMode.url) _directionToggle(),
            TextField(
              controller: _input,
              maxLines: widget.mode == TextToolMode.count || widget.mode == TextToolMode.json ? 9 : 5,
              decoration: InputDecoration(hintText: _hint()),
              style: TextStyle(
                fontSize: 14.5,
                fontFamily: widget.mode == TextToolMode.json || widget.mode == TextToolMode.base64 ? 'monospace' : null,
              ),
            ),
            const SizedBox(height: 18),
          ],
          ..._body(),
        ],
      ),
    );
  }

  String _hint() => switch (widget.mode) {
        TextToolMode.json => '{"name":"SnapGrab","tools":27}',
        TextToolMode.base64 => _encode ? 'Type text to encode…' : 'Paste Base64 to decode…',
        TextToolMode.url => 'https://example.com/search?q=hello world',
        TextToolMode.slug => 'How to Download YouTube Videos in 4K',
        _ => 'Paste or type your text…',
      };

  Widget _directionToggle() => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(
          children: [
            for (final enc in [true, false])
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: enc ? 8 : 0),
                  child: GestureDetector(
                    onTap: () => setState(() => _encode = enc),
                    child: AnimatedContainer(
                      duration: 200.ms,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        gradient: _encode == enc ? Brand.gradient : null,
                        color: _encode == enc ? null : context.c.soft,
                        borderRadius: BorderRadius.circular(13),
                        border: Border.all(color: _encode == enc ? Colors.transparent : context.c.line),
                      ),
                      child: Center(
                        child: Text(
                          enc ? 'Encode' : 'Decode',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            color: _encode == enc ? Colors.white : context.c.muted,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      );

  List<Widget> _body() => switch (widget.mode) {
        TextToolMode.count => _countBody(),
        TextToolMode.caseConvert => _rows(_caseRows()),
        TextToolMode.slug => _rows(_slugRows()),
        TextToolMode.hash => _hashBody(),
        TextToolMode.json => _jsonBody(),
        TextToolMode.base64 || TextToolMode.url => _codecBody(),
        TextToolMode.password => _passwordBody(),
        TextToolMode.uuid => _uuidBody(),
        TextToolMode.lorem => _loremBody(),
      };

  List<Widget> _countBody() {
    final s = TextTools.stats(_input.text);
    final cells = <(String, String)>[
      ('Words', '${s.words}'),
      ('Characters', '${s.characters}'),
      ('No spaces', '${s.charactersNoSpaces}'),
      ('Sentences', '${s.sentences}'),
      ('Paragraphs', '${s.paragraphs}'),
      ('Lines', '${s.lines}'),
      ('Reading time', s.readingTime),
      ('Longest word', s.longestWord.isEmpty ? '—' : s.longestWord),
    ];

    return [
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 2.1,
        children: [
          for (final c in cells)
            Surface(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ShaderMask(
                    shaderCallback: (r) => Brand.gradient.createShader(r),
                    child: Text(c.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19, color: Colors.white)),
                  ),
                  const SizedBox(height: 3),
                  Text(c.$1.toUpperCase(),
                      style: TextStyle(
                          color: context.c.muted, fontSize: 9.5, fontWeight: FontWeight.w800, letterSpacing: 0.7)),
                ],
              ),
            ),
        ],
      ),
    ];
  }

  List<(String, String)> _caseRows() {
    final t = _input.text;
    if (t.isEmpty) return [];
    return [
      ('UPPERCASE', TextTools.upper(t)),
      ('lowercase', TextTools.lower(t)),
      ('Title Case', TextTools.title(t)),
      ('Sentence case', TextTools.sentence(t)),
      ('camelCase', TextTools.camel(t)),
      ('PascalCase', TextTools.pascal(t)),
      ('snake_case', TextTools.snake(t)),
      ('kebab-case', TextTools.kebab(t)),
      ('CONSTANT_CASE', TextTools.constant(t)),
    ];
  }

  List<(String, String)> _slugRows() {
    final t = _input.text;
    if (t.isEmpty) return [];
    return [
      ('URL slug', TextTools.slug(t)),
      ('snake_case', TextTools.snake(t)),
      ('lowercase', TextTools.lower(t)),
      ('Title Case', TextTools.title(t)),
    ];
  }

  List<Widget> _rows(List<(String, String)> rows) {
    if (rows.isEmpty) {
      return [
        EmptyState(
          icon: Icons.text_fields_rounded,
          title: 'Enter some text',
          message: 'Results appear here as you type.',
        ),
      ];
    }
    return staggered([for (final r in rows) _resultRow(r.$1, r.$2)]);
  }

  List<Widget> _hashBody() {
    if (_input.text.isEmpty) {
      return [
        EmptyState(icon: Icons.tag_rounded, title: 'Enter some text', message: 'All four digests appear instantly.'),
      ];
    }
    final hashes = TextTools.hashes(_input.text);
    return staggered([for (final e in hashes.entries) _resultRow(e.key, e.value, mono: true)]);
  }

  List<Widget> _jsonBody() {
    if (_input.text.trim().isEmpty) {
      return [
        EmptyState(icon: Icons.data_object_rounded, title: 'Paste some JSON', message: 'It is validated as you type.'),
      ];
    }
    try {
      final pretty = TextTools.prettyJson(_input.text);
      final mini = TextTools.minifyJson(_input.text);
      final saved = _input.text.isEmpty ? 0 : ((_input.text.length - mini.length) / _input.text.length * 100).round();
      return [
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: context.c.success.withValues(alpha: 0.11),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(Icons.check_circle_rounded, size: 17, color: context.c.success),
              const SizedBox(width: 9),
              Text('Valid JSON · minifying saves $saved%',
                  style: TextStyle(color: context.c.success, fontWeight: FontWeight.w700, fontSize: 13)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _resultRow('Formatted', pretty, mono: true, block: true),
        _resultRow('Minified', mini, mono: true),
      ];
    } catch (e) {
      return [ErrorBanner(message: 'Invalid JSON — ${e.toString().replaceFirst('FormatException: ', '')}')];
    }
  }

  List<Widget> _codecBody() {
    if (_input.text.isEmpty) return [];
    try {
      final value = widget.mode == TextToolMode.base64
          ? (_encode ? TextTools.encodeBase64(_input.text) : TextTools.decodeBase64(_input.text))
          : (_encode ? TextTools.encodeUrl(_input.text) : TextTools.decodeUrl(_input.text));
      return [_resultRow(_encode ? 'Encoded' : 'Decoded', value, mono: true, block: true)];
    } catch (_) {
      return [
        ErrorBanner(
          message: _encode
              ? 'Could not encode that input.'
              : 'That is not valid ${widget.mode == TextToolMode.base64 ? 'Base64' : 'percent-encoded'} input.',
        ),
      ];
    }
  }

  List<Widget> _passwordBody() {
    final alphabetSize = (_useLower ? 26 : 0) +
        (_useUpper ? 26 : 0) +
        (_useDigits ? 10 : 0) +
        (_useSymbols ? Generators.symbols.length : 0);
    final entropy = Generators.entropyBits(_length.round(), alphabetSize).round();
    final label = entropy >= 128
        ? 'Excellent'
        : entropy >= 90
            ? 'Very strong'
            : entropy >= 60
                ? 'Strong'
                : entropy >= 40
                    ? 'Fair'
                    : 'Weak';
    final color = entropy >= 90
        ? context.c.success
        : entropy >= 60
            ? Brand.brand400
            : entropy >= 40
                ? context.c.warning
                : const Color(0xFFEF4444);

    return [
      Surface(
        child: Column(
          children: [
            SelectableText(
              _password.isEmpty ? 'Pick at least one character set' : _password,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 17, fontWeight: FontWeight.w700, height: 1.4),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _generatePassword,
                    icon: const Icon(Icons.refresh_rounded, size: 17),
                    label: const Text('New'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: GradientButton(
                    label: 'Copy',
                    icon: Icons.copy_rounded,
                    height: 46,
                    onPressed: _password.isEmpty ? null : () => _copy(_password, 'Password copied'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Strength: ', style: TextStyle(color: context.c.muted, fontSize: 13)),
                Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13)),
                const Spacer(),
                Text('$entropy bits', style: TextStyle(color: context.c.muted, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(5),
              child: LinearProgressIndicator(
                value: (entropy / 128).clamp(0, 1),
                minHeight: 6,
                backgroundColor: context.c.soft,
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                const Text('Length', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                const Spacer(),
                Text('${_length.round()}',
                    style: const TextStyle(color: Brand.brand400, fontWeight: FontWeight.w800)),
              ],
            ),
            Slider(
              value: _length,
              min: 6,
              max: 64,
              activeColor: Brand.brand500,
              onChanged: (v) {
                setState(() => _length = v);
                _generatePassword();
              },
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _toggleChip('a-z', _useLower, (v) => setState(() => _useLower = v)),
                _toggleChip('A-Z', _useUpper, (v) => setState(() => _useUpper = v)),
                _toggleChip('0-9', _useDigits, (v) => setState(() => _useDigits = v)),
                _toggleChip('!@#', _useSymbols, (v) => setState(() => _useSymbols = v)),
                _toggleChip('No look-alikes', _avoidAmbiguous, (v) => setState(() => _avoidAmbiguous = v)),
              ],
            ),
          ],
        ),
      ),
    ];
  }

  Widget _toggleChip(String label, bool value, void Function(bool) onChanged) => GestureDetector(
        onTap: () {
          onChanged(!value);
          _generatePassword();
        },
        child: AnimatedContainer(
          duration: 180.ms,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            gradient: value ? Brand.gradient : null,
            color: value ? null : context.c.soft,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: value ? Colors.transparent : context.c.line),
          ),
          child: Text(label,
              style: TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 12.5, color: value ? Colors.white : context.c.muted)),
        ),
      );

  List<Widget> _uuidBody() => [
        Surface(
          child: Row(
            children: [
              const Text('How many', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              const Spacer(),
              IconButton(
                onPressed: _count > 1
                    ? () {
                        setState(() => _count--);
                        _generateUuids();
                      }
                    : null,
                icon: const Icon(Icons.remove_circle_outline_rounded, size: 21),
              ),
              Text('$_count', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              IconButton(
                onPressed: _count < 100
                    ? () {
                        setState(() => _count++);
                        _generateUuids();
                      }
                    : null,
                icon: const Icon(Icons.add_circle_outline_rounded, size: 21),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _generateUuids,
                icon: const Icon(Icons.refresh_rounded, size: 17),
                label: const Text('Generate'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GradientButton(
                label: 'Copy all',
                icon: Icons.copy_rounded,
                height: 46,
                onPressed: _uuids.isEmpty ? null : () => _copy(_uuids.join('\n'), '${_uuids.length} UUIDs copied'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        ...staggered([for (final u in _uuids) _resultRow('', u, mono: true)], delayMs: 30),
      ];

  List<Widget> _loremBody() => [
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  for (final u in ['paragraphs', 'sentences', 'words'])
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 7),
                        child: GestureDetector(
                          onTap: () => setState(() => _unit = u),
                          child: AnimatedContainer(
                            duration: 180.ms,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              gradient: _unit == u ? Brand.gradient : null,
                              color: _unit == u ? null : context.c.soft,
                              borderRadius: BorderRadius.circular(11),
                            ),
                            child: Center(
                              child: Text(u,
                                  style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 11.5,
                                      color: _unit == u ? Colors.white : context.c.muted)),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  const Text('Amount', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  const Spacer(),
                  IconButton(
                    onPressed: _amount > 1 ? () => setState(() => _amount--) : null,
                    icon: const Icon(Icons.remove_circle_outline_rounded, size: 21),
                  ),
                  Text('$_amount', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  IconButton(
                    onPressed: _amount < (_unit == 'words' ? 300 : 20) ? () => setState(() => _amount++) : null,
                    icon: const Icon(Icons.add_circle_outline_rounded, size: 21),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _seed++),
                icon: const Icon(Icons.shuffle_rounded, size: 17),
                label: const Text('Shuffle'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GradientButton(
                label: 'Copy',
                icon: Icons.copy_rounded,
                height: 46,
                onPressed: () => _copy(Generators.lorem(unit: _unit, amount: _amount, seed: _seed), 'Text copied'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Surface(
          child: SelectableText(
            Generators.lorem(unit: _unit, amount: _amount, seed: _seed),
            style: TextStyle(color: context.c.muted, fontSize: 13.5, height: 1.65),
          ),
        ),
      ];

  Widget _resultRow(String label, String value, {bool mono = false, bool block = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Surface(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (label.isNotEmpty) ...[
              Row(
                children: [
                  Text(label.toUpperCase(),
                      style: TextStyle(
                          color: context.c.muted, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => _copy(value),
                    child: Icon(Icons.copy_rounded, size: 16, color: context.c.muted),
                  ),
                ],
              ),
              const SizedBox(height: 7),
            ],
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: block ? 260 : double.infinity),
              child: SingleChildScrollView(
                physics: block ? null : const NeverScrollableScrollPhysics(),
                child: SelectableText(
                  value,
                  style: TextStyle(fontSize: 13.5, height: 1.5, fontFamily: mono ? 'monospace' : null),
                ),
              ),
            ),
            if (label.isEmpty) ...[
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: GestureDetector(
                  onTap: () => _copy(value),
                  child: Icon(Icons.copy_rounded, size: 16, color: context.c.muted),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
