/**
 * Módulo Settings - Configurações da aplicação
 */
const SettingsView = (() => {
  function init() {
    const platformEl = document.getElementById('setting-platform');
    if (platformEl) {
      platformEl.textContent = `${detectOS()} — ${navigator.platform}`;
    }

    // Aplica temas salvos ANTES de carregar os módulos
    applySavedThemes();
    loadPreferences();
    initTitlebarTheme();       // Tema da titlebar (id=theme-selector)
    initAppThemeSelector();    // Tema de cor (id=app-theme-selector)
    initBgSettings();          // Fundo da janela + mídia
    initTerminalSettings();
    initEditorSettings();

    // Toggles
    document.querySelectorAll('.toggle input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', (e) => {
        localStorage.setItem(`pref:${e.target.id}`, e.target.checked);
      });
    });
  }

  // =================== APPLY SAVED THEMES EARLY ===================
  function applySavedThemes() {
    // Aplica tema de cor salvo
    const savedAppTheme = localStorage.getItem('pref:appTheme') || 'cyber';
    document.documentElement.setAttribute('data-app-theme', savedAppTheme);

    // Aplica estilo de fundo salvo
    const savedBgStyle = localStorage.getItem('pref:appBgStyle') || 'solid';
    document.documentElement.setAttribute('data-bg-style', savedBgStyle);

    // Aplica tema da titlebar salvo
    const savedTitleTheme = localStorage.getItem('pref:theme') || 'auto';
    const effective = getEffectiveTheme(savedTitleTheme);
    document.documentElement.setAttribute('data-theme', effective);
  }

  // =================== THEME (Window appearance) ===================
  function detectOS() {
    const p = navigator.platform.toLowerCase();
    if (p.includes('mac') || p.includes('darwin')) return 'macos';
    if (p.includes('win')) return 'windows';
    return 'linux';
  }

  function getEffectiveTheme(saved) {
    if (!saved || saved === 'auto') return detectOS();
    return saved;
  }

  function initTitlebarTheme() {
    // Suporta ambos os IDs (theme-selector para compatibilidade, window-theme-selector para o novo)
    const containers = [
      document.getElementById('window-theme-selector'),
      document.getElementById('theme-selector'),
    ];

    containers.forEach((container) => {
      if (!container) return;
      const buttons = container.querySelectorAll('.titlebar-opt');
      if (buttons.length === 0) return;
      const saved = localStorage.getItem('pref:theme') || 'auto';

      buttons.forEach((btn) => {
        if (btn.dataset.theme === saved) btn.classList.add('active');
        btn.addEventListener('click', () => {
          const val = btn.dataset.theme;
          // Atualiza todos os containers
          document.querySelectorAll('.titlebar-opt').forEach((b) => b.classList.remove('active'));
          document.querySelectorAll(`.titlebar-opt[data-theme="${val}"]`).forEach((b) => b.classList.add('active'));
          localStorage.setItem('pref:theme', val);
          const effective = getEffectiveTheme(val);
          document.documentElement.setAttribute('data-theme', effective);
        });
      });
    });

    const effective = getEffectiveTheme(localStorage.getItem('pref:theme') || 'auto');
    document.documentElement.setAttribute('data-theme', effective);
  }

  // =================== APP COLOR THEME ===================
  function initAppThemeSelector() {
    const container = document.getElementById('app-theme-selector');
    if (!container) return;
    const buttons = container.querySelectorAll('.color-grid-btn');
    const saved = localStorage.getItem('pref:appTheme') || 'cyber';

    buttons.forEach((btn) => {
      if (btn.dataset.appTheme === saved) btn.classList.add('active');
      btn.addEventListener('click', () => {
        const val = btn.dataset.appTheme;
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('pref:appTheme', val);
        document.documentElement.setAttribute('data-app-theme', val);
      });
    });

    document.documentElement.setAttribute('data-app-theme', saved);
  }

  // =================== BACKGROUND SETTINGS (CORRIGIDO) ===================
  async function selectBgFile(type) {
    try {
      const path = await window.api.selectMedia(type);
      if (!path) return;
      localStorage.setItem(`pref:bgMediaType`, type);
      localStorage.setItem(`pref:bgMediaPath`, path);
      document.getElementById('bg-file-name').textContent = path.split(/[\\/]/).pop();
      document.getElementById('bg-file-info').style.display = 'flex';
      const layer = document.getElementById('bg-media-layer');
      const img = document.getElementById('bg-image-el');
      const vid = document.getElementById('bg-video-el');
      if (!layer) return;
      layer.style.display = 'block';
      img.style.display = 'none';
      vid.style.display = 'none';
      if (type === 'image') { img.src = path; img.style.display = 'block'; }
      else { vid.src = path; vid.style.display = 'block'; vid.play().catch(()=>{}); }
    } catch (e) { console.error('Erro ao carregar mídia:', e); }
  }

  function removeBgFile() {
    ['bgMediaType','bgMediaPath'].forEach(k => localStorage.removeItem(`pref:${k}`));
    const layer = document.getElementById('bg-media-layer');
    if (layer) layer.style.display = 'none';
    document.getElementById('bg-image-el').src = '';
    document.getElementById('bg-video-el').src = '';
    document.getElementById('bg-video-el').style.display = 'none';
    document.getElementById('bg-file-info').style.display = 'none';
  }

  function initBgSettings() {
    const bgStyle = document.getElementById('app-bg-style');
    if (bgStyle) {
      const saved = localStorage.getItem('pref:appBgStyle') || 'solid';
      bgStyle.value = saved;
      applyBgStyle(saved);
      bgStyle.addEventListener('change', () => {
        localStorage.setItem('pref:appBgStyle', bgStyle.value);
        applyBgStyle(bgStyle.value);
      });
    }

    // Opacidade
    const opSlider = document.getElementById('app-bg-opacity');
    if (opSlider) {
      const saved = parseFloat(localStorage.getItem('pref:appBgOpacity')) || 0.3;
      opSlider.value = saved;
      applyBgMediaProp('opacity', saved);
      opSlider.addEventListener('input', () => {
        const v = parseFloat(opSlider.value);
        localStorage.setItem('pref:appBgOpacity', v);
        applyBgMediaProp('opacity', v);
      });
    }

    // Brilho
    const brSlider = document.getElementById('app-bg-brightness');
    if (brSlider) {
      const saved = parseFloat(localStorage.getItem('pref:appBgBrightness')) || 0.5;
      brSlider.value = saved;
      applyBgMediaProp('brightness', saved);
      brSlider.addEventListener('input', () => {
        const v = parseFloat(brSlider.value);
        localStorage.setItem('pref:appBgBrightness', v);
        applyBgMediaProp('brightness', v);
      });
    }

    // Imagem
    const btnImg = document.getElementById('btn-bg-image');
    if (btnImg) btnImg.addEventListener('click', () => selectBgFile('image'));

    // Vídeo
    const btnVid = document.getElementById('btn-bg-video');
    if (btnVid) btnVid.addEventListener('click', () => selectBgFile('video'));

    // Remover fundo
    const btnRm = document.getElementById('btn-bg-remove');
    if (btnRm) btnRm.addEventListener('click', removeBgFile);

    // Espelhar nos terminais
    const mirrorTerms = document.getElementById('setting-bg-mirror-terminals');
    if (mirrorTerms) {
      const saved = localStorage.getItem('pref:bgMirrorTerminals');
      mirrorTerms.checked = saved === 'true';
      mirrorTerms.addEventListener('change', () => {
        localStorage.setItem('pref:bgMirrorTerminals', mirrorTerms.checked);
      });
    }

    // Espelhar no explorador
    const mirrorFiles = document.getElementById('setting-bg-mirror-files');
    if (mirrorFiles) {
      const saved = localStorage.getItem('pref:bgMirrorFiles');
      mirrorFiles.checked = saved === 'true';
      mirrorFiles.addEventListener('change', () => {
        localStorage.setItem('pref:bgMirrorFiles', mirrorFiles.checked);
      });
    }

    // Concatena sliders de opacidade/brilho (já foram conectados acima)
    // Nota: os sliders já foram inicializados antes

    // Restaura mídia salva
    setTimeout(loadBgMedia, 100);
  }

  function applyBgStyle(style) {
    document.documentElement.setAttribute('data-bg-style', style);
  }

  function applyBgMediaProp(prop, value) {
    const layer = document.getElementById('bg-media-layer');
    const imgEl = document.getElementById('bg-image-el');
    const vidEl = document.getElementById('bg-video-el');
    if (!layer) return;

    if (prop === 'opacity') {
      layer.style.setProperty('--bg-media-opacity', value);
    } else if (prop === 'brightness') {
      layer.style.setProperty('--bg-media-brightness', value);
    }
  }

  function loadBgMedia() {
    const type = localStorage.getItem('pref:bgMediaType');
    const path = localStorage.getItem('pref:bgMediaPath');
    if (!type || !path) return;
    // Carrega diretamente sem abrir diálogo
    const layer = document.getElementById('bg-media-layer');
    const img = document.getElementById('bg-image-el');
    const vid = document.getElementById('bg-video-el');
    if (!layer) return;
    layer.style.display = 'block';
    img.style.display = 'none';
    vid.style.display = 'none';
    document.getElementById('bg-file-name').textContent = path.split(/[\\/]/).pop();
    document.getElementById('bg-file-info').style.display = 'flex';
    if (type === 'image') {
      img.src = path;
      img.style.display = 'block';
    } else {
      vid.src = path;
      vid.style.display = 'block';
      vid.play().catch(()=>{});
    }
  }

  // =================== CUSTOMIZAÇÃO DO TERMINAL ===================

  const TERMINAL_DEFAULTS = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    color: '#3DFF9C',
    opacity: 0.98,
    prompt: '$',
  };

  function initTerminalSettings() {
    // Tema preset
    const preset = document.getElementById('term-theme-preset');
    if (preset) {
      const saved = localStorage.getItem('pref:term-theme-preset') || 'custom';
      preset.value = saved;
      preset.addEventListener('change', () => {
        localStorage.setItem('pref:term-theme-preset', preset.value);
        applyTermThemePreset(preset.value);
      });
    }

    // Fonte
    const fontSelect = document.getElementById('term-font');
    if (fontSelect) {
      const saved = localStorage.getItem('pref:term-font') || TERMINAL_DEFAULTS.fontFamily;
      fontSelect.value = saved;
      fontSelect.addEventListener('change', () => {
        localStorage.setItem('pref:term-font', fontSelect.value);
        applyTerminalPref('fontFamily', fontSelect.value);
      });
    }

    // Tamanho
    const sizeInput = document.getElementById('term-size');
    if (sizeInput) {
      const saved = parseInt(localStorage.getItem('pref:term-size')) || TERMINAL_DEFAULTS.fontSize;
      sizeInput.value = saved;
      applyTerminalPref('fontSize', saved);
      sizeInput.addEventListener('change', () => {
        const val = Math.max(10, Math.min(24, parseInt(sizeInput.value) || 13));
        sizeInput.value = val;
        localStorage.setItem('pref:term-size', val);
        applyTerminalPref('fontSize', val);
      });
      document.querySelectorAll('.num-btn[data-target="term-size"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir);
          const cur = parseInt(sizeInput.value) || 13;
          const next = Math.max(10, Math.min(24, cur + dir));
          sizeInput.value = next;
          localStorage.setItem('pref:term-size', next);
          applyTerminalPref('fontSize', next);
        });
      });
    }

    // Cor
    const colorOpts = document.querySelectorAll('.color-opt');
    const savedColor = localStorage.getItem('pref:term-color') || TERMINAL_DEFAULTS.color;
    colorOpts.forEach((opt) => {
      if (opt.dataset.color === savedColor) opt.classList.add('active');
      opt.addEventListener('click', () => {
        colorOpts.forEach((o) => o.classList.remove('active'));
        opt.classList.add('active');
        const color = opt.dataset.color;
        localStorage.setItem('pref:term-color', color);
        applyTerminalPref('color', color);
      });
    });

    // Opacidade
    const opacityInput = document.getElementById('term-opacity');
    if (opacityInput) {
      const saved = parseFloat(localStorage.getItem('pref:term-opacity')) || TERMINAL_DEFAULTS.opacity;
      opacityInput.value = saved;
      applyTerminalPref('opacity', saved);
      opacityInput.addEventListener('input', () => {
        const val = parseFloat(opacityInput.value);
        localStorage.setItem('pref:term-opacity', val);
        applyTerminalPref('opacity', val);
      });
    }

    // Glow
    const glowInput = document.getElementById('term-glow');
    if (glowInput) {
      const saved = parseFloat(localStorage.getItem('pref:term-glow')) || 0.3;
      glowInput.value = saved;
      document.documentElement.style.setProperty('--term-glow', saved);
      glowInput.addEventListener('input', () => {
        const v = parseFloat(glowInput.value);
        localStorage.setItem('pref:term-glow', v);
        document.documentElement.style.setProperty('--term-glow', v);
      });
    }

    // Prompt
    const promptInput = document.getElementById('term-prompt');
    if (promptInput) {
      const saved = localStorage.getItem('pref:term-prompt') || TERMINAL_DEFAULTS.prompt;
      promptInput.value = saved;
      promptInput.addEventListener('change', () => {
        localStorage.setItem('pref:term-prompt', promptInput.value);
      });
    }

    // Background style
    const bgStyle = document.getElementById('term-bg-style');
    if (bgStyle) {
      const saved = localStorage.getItem('pref:term-bg-style') || 'solid';
      bgStyle.value = saved;
      bgStyle.addEventListener('change', () => {
        localStorage.setItem('pref:term-bg-style', bgStyle.value);
      });
    }

    // Echo
    const echo = document.getElementById('term-echo');
    if (echo) {
      const saved = localStorage.getItem('pref:term-echo');
      if (saved !== null) echo.checked = saved === 'true';
      echo.addEventListener('change', () => {
        localStorage.setItem('pref:term-echo', echo.checked);
      });
    }
  }

  function applyTermThemePreset(preset) {
    const presets = {
      hacker: { color: '#3DFF9C', glow: '0.2' },
      cyber: { color: '#5EF2FF', glow: '0.3' },
      amber: { color: '#FFBD2E', glow: '0.25' },
      snow: { color: '#FFFFFF', glow: '0.1' },
      matrix: { color: '#00FF41', glow: '0.2' },
      sunset: { color: '#FF86B5', glow: '0.25' },
      dracula: { color: '#BD93F9', glow: '0.3' },
      nord: { color: '#88C0D0', glow: '0.2' },
    };
    const p = presets[preset];
    if (!p) return;

    // Aplica nas cores
    const colorOpts = document.querySelectorAll('.color-opt');
    colorOpts.forEach((o) => {
      if (o.dataset.color === p.color) {
        o.classList.add('active');
        localStorage.setItem('pref:term-color', p.color);
        applyTerminalPref('color', p.color);
      } else {
        o.classList.remove('active');
      }
    });
    // Glow
    const glowInput = document.getElementById('term-glow');
    if (glowInput) {
      glowInput.value = p.glow;
      document.documentElement.style.setProperty('--term-glow', p.glow);
      localStorage.setItem('pref:term-glow', p.glow);
    }
  }

  function applyTerminalPref(key, value) {
    localStorage.setItem(`pref:term-${key}`, value);
    if (key === 'fontFamily') {
      document.documentElement.style.setProperty('--term-font-family', value);
    } else if (key === 'fontSize') {
      document.documentElement.style.setProperty('--term-font-size', value + 'px');
    } else if (key === 'color') {
      document.documentElement.style.setProperty('--term-color', value);
    } else if (key === 'opacity') {
      document.documentElement.style.setProperty('--term-bg-opacity', value);
    }
  }

  // =================== CUSTOMIZAÇÃO DO EDITOR ===================

  const EDITOR_DEFAULTS = {
    theme: 'dark',
    font: "'JetBrains Mono', monospace",
    fontSize: 14,
    lineHeight: 1.6,
    wordWrap: 'on',
  };

  function initEditorSettings() {
    const theme = document.getElementById('editor-theme');
    if (theme) {
      const saved = localStorage.getItem('pref:editor-theme') || EDITOR_DEFAULTS.theme;
      theme.value = saved;
      theme.addEventListener('change', () => {
        localStorage.setItem('pref:editor-theme', theme.value);
      });
    }

    const font = document.getElementById('editor-font');
    if (font) {
      const saved = localStorage.getItem('pref:editor-font') || EDITOR_DEFAULTS.font;
      font.value = saved;
      font.addEventListener('change', () => {
        localStorage.setItem('pref:editor-font', font.value);
      });
    }

    const size = document.getElementById('editor-font-size');
    if (size) {
      const saved = parseInt(localStorage.getItem('pref:editor-font-size')) || EDITOR_DEFAULTS.fontSize;
      size.value = saved;
      size.addEventListener('change', () => {
        const val = Math.max(10, Math.min(28, parseInt(size.value) || EDITOR_DEFAULTS.fontSize));
        size.value = val;
        localStorage.setItem('pref:editor-font-size', val);
      });

      document.querySelectorAll('.num-btn[data-target="editor-font-size"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir);
          const cur = parseInt(size.value) || EDITOR_DEFAULTS.fontSize;
          const next = Math.max(10, Math.min(28, cur + dir));
          size.value = next;
          localStorage.setItem('pref:editor-font-size', next);
        });
      });
    }

    const lineHeight = document.getElementById('editor-line-height');
    if (lineHeight) {
      const saved = parseFloat(localStorage.getItem('pref:editor-line-height')) || EDITOR_DEFAULTS.lineHeight;
      lineHeight.value = saved;
      lineHeight.addEventListener('input', () => {
        localStorage.setItem('pref:editor-line-height', lineHeight.value);
      });
    }

    const wordWrap = document.getElementById('editor-word-wrap');
    if (wordWrap) {
      const saved = localStorage.getItem('pref:editor-word-wrap') || EDITOR_DEFAULTS.wordWrap;
      wordWrap.value = saved;
      wordWrap.addEventListener('change', () => {
        localStorage.setItem('pref:editor-word-wrap', wordWrap.value);
      });
    }
  }

  // =================== PREFS ===================

  function loadPreferences() {
    document.querySelectorAll('.toggle input[type="checkbox"]').forEach((input) => {
      const saved = localStorage.getItem(`pref:${input.id}`);
      if (saved !== null) input.checked = saved === 'true';
    });
  }

  return { init };
})();
