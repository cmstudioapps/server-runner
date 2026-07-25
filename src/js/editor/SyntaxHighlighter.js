/**
 * SyntaxHighlighter
 *
 * Responsável APENAS por converter texto puro em HTML com spans coloridos.
 *
 * - RECEBE: string (texto puro)
 * - RETORNA: string (HTML com <span class="hl-*">)
 * - NUNCA modifica o texto original
 * - NUNCA salva nada
 * - NUNCA lê do DOM
 *
 * Arquitetura:
 *   Texto puro → SyntaxHighlighter.highlight(texto, linguagem) → HTML
 *
 * As classes CSS são:
 *   hl-comment  → comentários
 *   hl-string   → strings (aspas simples, duplas, template literals)
 *   hl-keyword  → palavras-chave da linguagem
 *   hl-number   → números
 *   hl-attr     → atributos HTML
 *
 * Este módulo é 100% puro: mesma entrada → mesma saída, sem efeitos colaterais.
 */

const SyntaxHighlighter = (() => {
  'use strict';

  // ======================== CONFIGURAÇÃO ========================

  /** Palavras-chave por linguagem */
  const KEYWORDS = {
    js: /\b(await|async|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|var|void|while|with|yield)\b/g,
    html: /\b(html|head|body|div|span|script|style|link|meta|title|header|footer|nav|main|section|article|aside|h[1-6]|p|a|img|input|button|form|table|tr|td|th|ul|ol|li|br|hr|label|select|option|textarea|iframe|canvas|video|audio|source|figure|figcaption|blockquote|pre|code|strong|em|small|mark|del|ins|sub|sup)\b/g,
  };

  /** Regex para strings (simples, duplas, template literals) */
  const RE_STRINGS = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

  /** Regex para comentários (lembrando que HTML já foi escapado) */
  const RE_COMMENTS = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|&lt;!--[\s\S]*?--&gt;)/g;

  /** Regex para números */
  const RE_NUMBERS = /\b(\d+\.?\d*)\b/g;

  /** Regex para atributos HTML */
  const RE_ATTRS = /(\b(class|id|style|src|href|rel|type|name|value|placeholder|data-\w+|on\w+|alt|title|width|height|target|disabled|checked|selected|role|aria-\w+)\b|[#.]\w[\w-]*)/g;

  // ======================== MAPA DE EXTENSÕES ========================

  /**
   * Mapeia extensão de arquivo para linguagem de highlight.
   * @param {string} ext - Extensão do arquivo (ex: 'js', 'html')
   * @returns {string} Linguagem ('js', 'html', 'css', 'json', 'md', ou 'js' como fallback)
   */
  function extToLang(ext) {
    const map = {
      js: 'js', mjs: 'js', cjs: 'js',
      ts: 'js', mts: 'js', cts: 'js',
      jsx: 'js', tsx: 'js',
      html: 'html', htm: 'html', xml: 'html', svg: 'html',
      css: 'css', scss: 'css', less: 'css',
      json: 'json',
      md: 'md',
    };
    // Para linguagens sem highlight específico, usa JS-like
    const jsLike = ['py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
      'go', 'rs', 'swift', 'kt', 'sh', 'bash', 'zsh', 'yaml', 'yml',
      'sql', 'graphql', 'vue', 'svelte', 'astro'];
    if (map[ext]) return map[ext];
    if (jsLike.includes(ext)) return 'js';
    return 'none';
  }

  /**
   * Escapa caracteres HTML no texto.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ======================== HIGHLIGHT ========================

  /**
   * Aplica syntax highlighting a um texto puro.
   *
   * @param {string} code - O texto puro do código-fonte
   * @param {string} filename - Nome do arquivo (para detectar linguagem)
   * @returns {string} HTML com spans de highlight — NUNCA retorna o código puro com tags visíveis
   *
   * Exemplo:
   *   Input:  `import express from 'express';`
   *   Output: `<span class="hl-keyword">import</span> express <span class="hl-keyword">from</span> <span class="hl-string">'express'</span>;`
   *
   * Garantia: o texto original NUNCA é alterado. Apenas envolto em <span>.
   */
  function highlight(code, filename) {
    if (!code || typeof code !== 'string') return '';

    const ext = (filename || '').split('.').pop().toLowerCase();
    const lang = extToLang(ext);

    // Se não é highlightable, retorna texto escapado sem spans
    if (lang === 'none') {
      return escapeHtml(code);
    }

    // PASSO 1: Escapar HTML
    let html = escapeHtml(code);

    // PASSO 2: Aplicar spans usando tokens para evitar conflitos
    const tokens = [];
    let tokenIndex = 0;

    function saveToken(spanHtml) {
      const id = `@@TOKEN${tokenIndex++}@@`;
      tokens.push({ id, html: spanHtml });
      return id;
    }

    // 2a. Comentários (mais prioritários)
    html = html.replace(RE_COMMENTS, (match) => {
      return saveToken(`<span class="hl-comment">${match}</span>`);
    });

    // 2b. Strings
    html = html.replace(RE_STRINGS, (match) => {
      return saveToken(`<span class="hl-string">${match}</span>`);
    });

    // 2c. Palavras-chave (apenas JS-like)
    if (lang === 'js') {
      html = html.replace(KEYWORDS.js, (match, p1) => {
        return saveToken(`<span class="hl-keyword">${p1}</span>`);
      });
    }

    // 2d. Números
    html = html.replace(RE_NUMBERS, (match, p1) => {
      return saveToken(`<span class="hl-number">${p1}</span>`);
    });

    // 2e. Atributos HTML
    if (lang === 'html') {
      html = html.replace(RE_ATTRS, (match, p1) => {
        return saveToken(`<span class="hl-attr">${p1}</span>`);
      });
    }

    // PASSO 3: Restaurar os tokens
    for (let i = tokens.length - 1; i >= 0; i--) {
      html = html.replace(tokens[i].id, tokens[i].html);
    }

    return html;
  }

  /**
   * Verifica se uma extensão de arquivo tem suporte a highlight.
   * @param {string} filename
   * @returns {boolean}
   */
  function isHighlightable(filename) {
    if (!filename) return false;
    const ext = filename.split('.').pop().toLowerCase();
    const supported = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx',
      'html', 'htm', 'xml', 'svg', 'css', 'scss', 'less', 'json', 'md',
      'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs',
      'swift', 'kt', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'vue', 'svelte', 'astro'
    ];
    return supported.includes(ext);
  }

  // ======================== API PÚBLICA ========================

  return {
    highlight,
    isHighlightable,
    extToLang,
  };
})();

// Tornando disponível globalmente
window.SyntaxHighlighter = SyntaxHighlighter;
