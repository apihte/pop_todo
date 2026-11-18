export interface LanguageFile { lang: string; [key: string]: string }
export interface Language { code: string; name: string; locale: string; messages: LanguageFile }

export function localeTag(code: string): string {
  return Intl.getCanonicalLocales(code.replaceAll('_', '-'))[0];
}

export function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

export function buildLanguages(files: Record<string, unknown>, fallback: LanguageFile): Language[] {
  return Object.entries(files).map(([path, value]) => {
    const code = path.split('/').at(-1)?.replace(/\.json$/, '') ?? '';
    if (!/^[a-z]{2,3}(?:_[a-z0-9]{2,8})*$/.test(code)) throw new Error(`Invalid language filename: ${path}`);
    if (!value || typeof value !== 'object' || !('lang' in value) || typeof value.lang !== 'string' || !value.lang.trim()) {
      throw new Error(`Missing language display name (lang): ${path}`);
    }
    const messages = value as LanguageFile;
    for (const [key, text] of Object.entries(messages)) {
      if (typeof text !== 'string' || !text.trim()) throw new Error(`Invalid translation ${code}:${key}`);
      if (fallback[key] && placeholders(text).join(',') !== placeholders(fallback[key]).join(',')) {
        throw new Error(`Translation placeholders do not match: ${code}:${key}`);
      }
    }
    return { code, name: messages.lang, locale: localeTag(code), messages };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

export function translate(messages: LanguageFile, fallback: LanguageFile, key: string, params: Record<string, string | number> = {}): string {
  return (messages[key] ?? fallback[key] ?? key).replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}
