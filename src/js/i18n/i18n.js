/**
 * Módulo i18n - Internacionalização
 *
 * Idiomas: pt-BR, en, ja
 * Auto-detect via navigator.language
 * Fallback para pt-BR se não conseguir detectar
 */

const I18n = (() => {
  // Registro de idiomas
  const LANGUAGES = {
    'pt-br': LANG_PT_BR,
    'en': LANG_EN,
    'ja': LANG_JA,
  };

  const LANGUAGE_NAMES = {
    'pt-br': 'Português (Brasil)',
    'en': 'English',
    'ja': '日本語',
  };

  let currentLang = 'pt-br';
  let currentDict = LANG_PT_BR;

  /**
   * Detecta o idioma do sistema do usuário
   */
  function detectSystemLang() {
    try {
      const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      // navigator.language returns 'pt-BR', 'en-US', 'ja-JP', etc.
      if (navLang.startsWith('pt')) return 'pt-br';
      if (navLang.startsWith('ja')) return 'ja';
      if (navLang.startsWith('en')) return 'en';
    } catch {}
    return 'pt-br';
  }

  /**
   * Inicializa o tradutor
   * 1. Tenta ler preferência salva
   * 2. Se não existir, detecta o idioma do sistema
   * 3. Aplica o idioma
   */
  function init() {
    const saved = localStorage.getItem('pref:language');
    if (saved && LANGUAGES[saved]) {
      setLanguage(saved, false);
    } else {
      const detected = detectSystemLang();
      setLanguage(detected, false);
      // Salva o detectado para não detectar toda vez
      if (!saved) {
        localStorage.setItem('pref:language', detected);
      }
    }
  }

  /**
   * Define o idioma ativo
   */
  function setLanguage(langCode, save = true) {
    if (!LANGUAGES[langCode]) {
      console.warn(`Idioma "${langCode}" não disponível, usando pt-br`);
      langCode = 'pt-br';
    }

    currentLang = langCode;
    currentDict = LANGUAGES[langCode];

    if (save) {
      localStorage.setItem('pref:language', langCode);
    }

    // Marca o HTML com o idioma
    document.documentElement.setAttribute('lang', langCode === 'pt-br' ? 'pt-BR' : langCode === 'ja' ? 'ja' : 'en');

    // Re-aplica todas as traduções
    translateAll();
  }

  /**
   * Traduz uma chave (ex: "sidebar.dashboard")
   * Suporta interpolação com {var}
   */
  function t(key, vars = {}) {
    const parts = key.split('.');
    let value = currentDict;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // Fallback para pt-BR
        let fallback = LANG_PT_BR;
        for (const p of parts) {
          if (fallback && typeof fallback === 'object' && p in fallback) {
            fallback = fallback[p];
          } else {
            return key; // key não encontrada
          }
        }
        value = fallback;
        break;
      }
    }

    if (typeof value !== 'string') return key;

    // Interpolação
    return value.replace(/\{(\w+)\}/g, (_, v) => vars[v] !== undefined ? vars[v] : `{${v}}`);
  }

  /**
   * Traduz todos os elementos com data-i18n no DOM
   */
  function translateAll(root = document) {
    // data-i18n = chave da tradução
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const varsAttr = el.getAttribute('data-i18n-vars');
      let vars = {};
      if (varsAttr) {
        try { vars = JSON.parse(varsAttr); } catch {}
      }
      el.textContent = t(key, vars);
    });

    // data-i18n-placeholder = placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // data-i18n-title = tooltip
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
  }

  function getCurrentLang() {
    return currentLang;
  }

  function getLanguageName(code) {
    return LANGUAGE_NAMES[code] || code;
  }

  function getAvailableLanguages() {
    return Object.keys(LANGUAGES);
  }

  return {
    init,
    setLanguage,
    t,
    translateAll,
    getCurrentLang,
    getLanguageName,
    getAvailableLanguages,
    detectSystemLang,
    LANGUAGES,
  };
})();
