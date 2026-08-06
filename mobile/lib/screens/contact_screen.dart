import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

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
  final _messageFocus = FocusNode();

  String _subject = _subjects.first.label;
  bool _sending = false;
  bool _sent = false;
  String? _error;

  static const _subjects = [
    (label: 'A link failed', icon: Icons.link_off_rounded),
    (label: 'Platform request', icon: Icons.add_circle_outline_rounded),
    (label: 'General question', icon: Icons.help_outline_rounded),
    (label: 'Bug report', icon: Icons.bug_report_outlined),
    (label: 'Copyright / DMCA', icon: Icons.gavel_rounded),
    (label: 'Advertising', icon: Icons.campaign_outlined),
  ];

  static const _maxMessage = 2000;

  @override
  void initState() {
    super.initState();
    _message.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _message.dispose();
    _messageFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      HapticFeedback.lightImpact();
      return;
    }

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
      HapticFeedback.mediumImpact();
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
      appBar: AppBar(title: const Text('Contact support')),
      body: _sent ? _successView() : _formView(),
    );
  }

  /* ----------------------------- success ----------------------------- */

  Widget _successView() => Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: context.c.success.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.mark_email_read_rounded, size: 40, color: context.c.success),
              )
                  .animate()
                  .scale(begin: const Offset(0.6, 0.6), end: const Offset(1, 1), duration: 520.ms, curve: Curves.easeOutBack)
                  .fadeIn(),
              const SizedBox(height: 24),
              const Text('Message sent',
                  style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800, letterSpacing: -0.4)),
              const SizedBox(height: 10),
              Text(
                'Thanks, ${_name.text.trim().split(' ').first}. We reply to almost everything within one business day — '
                'check ${_email.text.trim()} for our response.',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.c.muted, fontSize: 14.5, height: 1.6),
              ),
              const SizedBox(height: 26),
              Surface(
                child: Row(
                  children: [
                    Icon(Icons.inbox_rounded, size: 18, color: context.c.muted),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text('Subject: $_subject',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              GradientButton(
                label: 'Back to the app',
                icon: Icons.arrow_back_rounded,
                onPressed: () => Navigator.of(context).pop(),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => setState(() {
                  _sent = false;
                  _message.clear();
                }),
                child: const Text('Send another message'),
              ),
            ],
          ).animate().fadeIn(duration: 380.ms),
        ),
      );

  /* ------------------------------ form ------------------------------ */

  Widget _formView() => Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 34),
          children: [
            _headerCard(),
            const SizedBox(height: 20),
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 16)],

            _label('What is this about?'),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in _subjects)
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _subject = s.label);
                    },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: _subject == s.label ? Brand.gradient : null,
                        color: _subject == s.label ? null : context.scheme.surface,
                        borderRadius: BorderRadius.circular(13),
                        border: Border.all(
                          color: _subject == s.label ? Colors.transparent : context.c.line,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(s.icon, size: 15, color: _subject == s.label ? Colors.white : context.c.muted),
                          const SizedBox(width: 7),
                          Text(
                            s.label,
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: _subject == s.label ? Colors.white : context.c.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),

            const SizedBox(height: 22),
            _label('Your details'),
            const SizedBox(height: 10),
            TextFormField(
              controller: _name,
              textInputAction: TextInputAction.next,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Full name',
                prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
              ),
              validator: (v) => (v ?? '').trim().length < 2 ? 'Please tell us your name.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Email address',
                helperText: 'We reply here — no marketing, ever.',
                prefixIcon: Icon(Icons.alternate_email_rounded, size: 20),
              ),
              validator: (v) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch((v ?? '').trim())
                  ? null
                  : 'That email address does not look right.',
            ),

            const SizedBox(height: 22),
            Row(
              children: [
                _label('Your message'),
                const Spacer(),
                Text(
                  '${_message.text.length}/$_maxMessage',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: _message.text.length > _maxMessage ? const Color(0xFFEF4444) : context.c.muted,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _message,
              focusNode: _messageFocus,
              maxLines: 7,
              maxLength: _maxMessage,
              buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: _subject == 'A link failed'
                    ? 'Paste the link you tried, and tell us what you saw.'
                    : _subject == 'Platform request'
                        ? 'Which site, and roughly how often would you use it?'
                        : 'Tell us what is on your mind.',
                alignLabelWithHint: true,
              ),
              validator: (v) => (v ?? '').trim().length < 10 ? 'A little more detail helps us help you.' : null,
            ),

            const SizedBox(height: 20),
            GradientButton(
              label: _sending ? 'Sending…' : 'Send message',
              icon: Icons.send_rounded,
              busy: _sending,
              onPressed: _sending ? null : _submit,
            ),
            const SizedBox(height: 16),
            _footerNote(),
          ],
        ),
      );

  Widget _label(String text) =>
      Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.1));

  Widget _headerCard() => Surface(
        radius: 22,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(gradient: Brand.gradientBr, borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 23),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('We read every message',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 3),
                      Text('A real person replies, usually within a business day.',
                          style: TextStyle(color: context.c.muted, fontSize: 12.5, height: 1.4)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Divider(color: context.c.line, height: 1),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _miniStat(Icons.schedule_rounded, 'Response', 'Under 24 h'),
                ),
                Container(width: 1, height: 32, color: context.c.line),
                Expanded(
                  child: _miniStat(Icons.mail_outline_rounded, 'Email', 'support@'),
                ),
              ],
            ),
          ],
        ),
      ).animate().fadeIn(duration: 380.ms).slideY(begin: 0.08, end: 0);

  Widget _miniStat(IconData icon, String label, String value) => Column(
        children: [
          Icon(icon, size: 17, color: Brand.brand400),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 2),
          Text(label.toUpperCase(),
              style: TextStyle(color: context.c.muted, fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
        ],
      );

  Widget _footerNote() => Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.lock_outline_rounded, size: 15, color: context.c.muted),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  'Your message and email are stored so we can reply, and nothing else. '
                  'They are never sold or used for marketing.',
                  style: TextStyle(color: context.c.muted, fontSize: 11.5, height: 1.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Center(
            child: TextButton.icon(
              onPressed: () => launchUrl(
                Uri.parse('${AppConfig.apiBase}/privacy'),
                mode: LaunchMode.externalApplication,
              ),
              icon: const Icon(Icons.open_in_new_rounded, size: 15),
              label: const Text('Read the privacy policy', style: TextStyle(fontSize: 12.5)),
            ),
          ),
        ],
      );
}
