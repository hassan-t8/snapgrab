import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand palette, kept in step with the web app's CSS custom properties.
class Brand {
  static const brand50 = Color(0xFFF2F0FF);
  static const brand300 = Color(0xFFB0A1FF);
  static const brand400 = Color(0xFF8F74FF);
  static const brand500 = Color(0xFF7048F0);
  static const brand600 = Color(0xFF5A2FD6);

  static const accent400 = Color(0xFF38E0D0);
  static const accent500 = Color(0xFF14C8BE);
  static const accent600 = Color(0xFF0AA39C);

  static const darkBg = Color(0xFF07060F);
  static const darkSurface = Color(0xFF110E21);
  static const darkSoft = Color(0xFF0D0B1A);
  static const darkLine = Color(0x17FFFFFF);
  static const darkText = Color(0xFFF4F2FF);
  static const darkMuted = Color(0xFFA9A3C4);

  static const lightBg = Color(0xFFFFFFFF);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSoft = Color(0xFFF6F5FB);
  static const lightLine = Color(0xFFE7E4F2);
  static const lightText = Color(0xFF14121F);
  static const lightMuted = Color(0xFF5C5872);

  static const gradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [brand500, accent500],
  );

  static const gradientBr = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brand500, accent500],
  );
}

/// Extra colours the Material scheme has no slot for.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.muted,
    required this.soft,
    required this.line,
    required this.success,
    required this.warning,
  });

  final Color muted;
  final Color soft;
  final Color line;
  final Color success;
  final Color warning;

  @override
  AppColors copyWith({Color? muted, Color? soft, Color? line, Color? success, Color? warning}) => AppColors(
        muted: muted ?? this.muted,
        soft: soft ?? this.soft,
        line: line ?? this.line,
        success: success ?? this.success,
        warning: warning ?? this.warning,
      );

  @override
  AppColors lerp(AppColors? other, double t) {
    if (other == null) return this;
    return AppColors(
      muted: Color.lerp(muted, other.muted, t)!,
      soft: Color.lerp(soft, other.soft, t)!,
      line: Color.lerp(line, other.line, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
    );
  }
}

class AppTheme {
  static ThemeData dark() => _build(Brightness.dark);
  static ThemeData light() => _build(Brightness.light);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final bg = isDark ? Brand.darkBg : Brand.lightBg;
    final surface = isDark ? Brand.darkSurface : Brand.lightSurface;
    final text = isDark ? Brand.darkText : Brand.lightText;
    final muted = isDark ? Brand.darkMuted : Brand.lightMuted;
    final line = isDark ? Brand.darkLine : Brand.lightLine;
    final soft = isDark ? Brand.darkSoft : Brand.lightSoft;

    final scheme = ColorScheme(
      brightness: brightness,
      primary: Brand.brand500,
      onPrimary: Colors.white,
      secondary: Brand.accent500,
      onSecondary: Colors.white,
      surface: surface,
      onSurface: text,
      error: const Color(0xFFEF4444),
      onError: Colors.white,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);

    return base.copyWith(
      scaffoldBackgroundColor: bg,
      canvasColor: bg,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
        bodyColor: text,
        displayColor: text,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: text,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: text),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        hintStyle: TextStyle(color: muted, fontSize: 15),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Brand.brand400, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: Brand.brand500,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          side: BorderSide(color: line),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 14),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: surface,
        contentTextStyle: TextStyle(color: text),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      dividerTheme: DividerThemeData(color: line, thickness: 1, space: 1),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? const Color(0xFF0B0918) : Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Brand.brand500.withValues(alpha: 0.18),
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => GoogleFonts.plusJakartaSans(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
            color: states.contains(WidgetState.selected) ? Brand.brand400 : muted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 23,
            color: states.contains(WidgetState.selected) ? Brand.brand400 : muted,
          ),
        ),
      ),
      extensions: <ThemeExtension<dynamic>>[
        AppColors(
          muted: muted,
          soft: soft,
          line: line,
          success: Brand.accent500,
          warning: const Color(0xFFF59E0B),
        ),
      ],
    );
  }
}

extension AppColorsX on BuildContext {
  AppColors get c => Theme.of(this).extension<AppColors>()!;
  ColorScheme get scheme => Theme.of(this).colorScheme;
  TextTheme get text => Theme.of(this).textTheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}
