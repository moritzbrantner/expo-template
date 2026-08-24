export const supportedLocales = ['en', 'de', 'es'] as const;
export type AppLocale = (typeof supportedLocales)[number];

const messages = {
  en: {
    appReady: 'Your shared app foundation is ready.',
    buildWorkflow: 'Build the product-specific workflow from here.',
    settings: 'Settings',
    appearance: 'Appearance',
    language: 'Language',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    account: 'Account',
    signIn: 'Sign in',
    email: 'Email',
    password: 'Password',
    continue: 'Continue',
    signedIn: 'Signed in. Your session is stored securely.',
  },
  de: {
    appReady: 'Deine gemeinsame App-Basis ist bereit.',
    buildWorkflow: 'Erstelle von hier aus den produktspezifischen Ablauf.',
    settings: 'Einstellungen',
    appearance: 'Darstellung',
    language: 'Sprache',
    theme: 'Design',
    system: 'System',
    light: 'Hell',
    dark: 'Dunkel',
    account: 'Konto',
    signIn: 'Anmelden',
    email: 'E-Mail',
    password: 'Passwort',
    continue: 'Weiter',
    signedIn: 'Angemeldet. Deine Sitzung ist sicher gespeichert.',
  },
  es: {
    appReady: 'La base compartida de tu aplicación está lista.',
    buildWorkflow: 'Crea desde aquí el flujo específico del producto.',
    settings: 'Ajustes',
    appearance: 'Apariencia',
    language: 'Idioma',
    theme: 'Tema',
    system: 'Sistema',
    light: 'Claro',
    dark: 'Oscuro',
    account: 'Cuenta',
    signIn: 'Iniciar sesión',
    email: 'Correo',
    password: 'Contraseña',
    continue: 'Continuar',
    signedIn: 'Sesión iniciada y almacenada de forma segura.',
  },
} as const;

export type TranslationKey = keyof (typeof messages)['en'];

export function translate(locale: AppLocale, key: TranslationKey) {
  return messages[locale][key] ?? messages.en[key];
}
