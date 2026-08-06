import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../main.dart';
import '../widgets/common.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  Future<void> _open(String path) async {
    final uri = Uri.parse(path.startsWith('http') ? path : '${AppConfig.apiBase}$path');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 4, 18, 32),
        children: [
          _brandCard(context),
          const SizedBox(height: 20),
          const SectionHeader(title: 'Appearance'),
          const SizedBox(height: 12),
          _themePicker(context),
          const SizedBox(height: 22),
          const SectionHeader(title: 'Support'),
          const SizedBox(height: 12),
          ...staggered([
            _tile(context, Icons.mail_outline_rounded, 'Contact us', 'Bug reports and requests',
                () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ContactScreen()))),
            _tile(context, Icons.help_outline_rounded, 'FAQ', 'Answers to common questions', () => _open('/faq')),
            _tile(context, Icons.info_outline_rounded, 'About SnapGrab', 'Who builds this', () => _open('/about')),
          ]),
          const SizedBox(height: 22),
          const SectionHeader(title: 'Legal'),
          const SizedBox(height: 12),
          ...staggered([
            _tile(context, Icons.privacy_tip_outlined, 'Privacy policy', 'What we log and why', () => _open('/privacy')),
            _tile(context, Icons.gavel_rounded, 'Terms of service', 'The rules for using SnapGrab', () => _open('/terms')),
            _tile(context, Icons.copyright_rounded, 'DMCA', 'Copyright takedowns', () => _open('/dmca')),
          ]),
          const SizedBox(height: 22),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.dns_rounded, size: 17, color: context.c.muted),
                    const SizedBox(width: 9),
                    const Text('Server', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  ],
                ),
                const SizedBox(height: 8),
                SelectableText(AppConfig.apiBase,
                    style: TextStyle(color: context.c.muted, fontSize: 12.5, fontFamily: 'monospace')),
                const SizedBox(height: 10),
                Text(
                  'Point the app at another server by building with '
                  '--dart-define=SNAPGRAB_API=https://your-domain.com',
                  style: TextStyle(color: context.c.muted, fontSize: 11.5, height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Center(
            child: Text('SnapGrab · version 1.0.0',
                style: TextStyle(color: context.c.muted, fontSize: 11.5)),
          ),
          const SizedBox(height: 10),
          Center(
            child: Text(
              'Not affiliated with YouTube, Meta, TikTok or X.\nDownload only what you own or have rights to.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.c.muted, fontSize: 10.5, height: 1.6),
            ),
          ),
        ],
      ),
    );
  }

  Widget _brandCard(BuildContext context) => Surface(
        radius: 22,
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(gradient: Brand.gradientBr, borderRadius: BorderRadius.circular(17)),
              child: const Icon(Icons.download_rounded, color: Colors.white, size: 26),
            ),
            const SizedBox(width: 15),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.4),
                      children: const [
                        TextSpan(text: 'Snap'),
                        TextSpan(text: 'Grab', style: TextStyle(color: Brand.accent500)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('14 platforms · 13 offline tools',
                      style: TextStyle(color: context.c.muted, fontSize: 12.5)),
                ],
              ),
            ),
          ],
        ),
      ).animate().fadeIn(duration: 400.ms);

  Widget _themePicker(BuildContext context) => ValueListenableBuilder<ThemeMode>(
        valueListenable: themeMode,
        builder: (context, mode, _) => Surface(
          padding: const EdgeInsets.all(6),
          child: Row(
            children: [
              for (final m in ThemeMode.values)
                Expanded(
                  child: GestureDetector(
                    onTap: () => saveThemeMode(m),
                    child: AnimatedContainer(
                      duration: 200.ms,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        gradient: mode == m ? Brand.gradient : null,
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            switch (m) {
                              ThemeMode.dark => Icons.dark_mode_rounded,
                              ThemeMode.light => Icons.light_mode_rounded,
                              ThemeMode.system => Icons.brightness_auto_rounded,
                            },
                            size: 19,
                            color: mode == m ? Colors.white : context.c.muted,
                          ),
                          const SizedBox(height: 5),
                          Text(
                            switch (m) {
                              ThemeMode.dark => 'Dark',
                              ThemeMode.light => 'Light',
                              ThemeMode.system => 'System',
                            },
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: mode == m ? Colors.white : context.c.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );

  Widget _tile(BuildContext context, IconData icon, String title, String subtitle, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(bottom: 9),
        child: Surface(
          onTap: onTap,
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Brand.brand500.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 18, color: Brand.brand400),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(color: context.c.muted, fontSize: 12)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: context.c.muted),
            ],
          ),
        ),
      );
}

class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});

  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _message = TextEditingController();
  String _subject = 'General question';
  bool _sending = false;
  bool _sent = false;
  String? _error;

  static const _subjects = [
    'General question',
    'A link failed',
    'Platform request',
    'Copyright / DMCA',
    'Advertising',
    'Other',
  ];

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await Api.instance.contact(
        name: _name.text.trim(),
        email: _email.text.trim(),
        subject: _subject,
        message: _message.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _sent = true;
        _sending = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _sending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contact us')),
      body: _sent
          ? EmptyState(
              icon: Icons.mark_email_read_rounded,
              title: 'Message received',
              message: 'We reply to almost everything within one business day.',
              action: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Back'),
              ),
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 32),
                children: [
                  if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 16)],
                  TextFormField(
                    controller: _name,
                    decoration: const InputDecoration(labelText: 'Your name'),
                    validator: (v) => (v ?? '').trim().length < 2 ? 'Please enter your name.' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email address'),
                    validator: (v) =>
                        RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch((v ?? '').trim()) ? null : 'Enter a valid email.',
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: _subject,
                    decoration: const InputDecoration(labelText: 'Subject'),
                    items: [for (final s in _subjects) DropdownMenuItem(value: s, child: Text(s))],
                    onChanged: (v) => setState(() => _subject = v ?? _subject),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _message,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      labelText: 'Message',
                      alignLabelWithHint: true,
                      hintText: 'Tell us what happened, and paste the link you tried.',
                    ),
                    validator: (v) => (v ?? '').trim().length < 10 ? 'Please add a little more detail.' : null,
                  ),
                  const SizedBox(height: 20),
                  GradientButton(
                    label: 'Send message',
                    icon: Icons.send_rounded,
                    busy: _sending,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
    );
  }
}
