/**
 * ServerRunner - App Principal
 * Inicializa todos os módulos
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 ServerRunner iniciando...');

  // Inicializa i18n (traduções) primeiro
  I18n.init();

  // Conecta o seletor de idioma
  const langSel = document.getElementById('lang-selector');
  if (langSel) {
    langSel.value = I18n.getCurrentLang();
    langSel.addEventListener('change', (e) => {
      I18n.setLanguage(e.target.value);
      // Recarrega settings traduzidos
      SettingsView.init();
    });
  }

  // Inicializa módulos
  Sidebar.init();
  Dashboard.init();
  AddServerModal.init();
  SystemMonitor.init();
  LogsView.init();
  SettingsView.init();

  // Inicia monitoramento
  window.api.startMonitor();

  // Pequeno reveal da interface após o primeiro frame renderizado
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
    });
  });

  // Window controls
  document.getElementById('btn-win-minimize')?.addEventListener('click', () => window.api.minimize());
  document.getElementById('btn-win-maximize')?.addEventListener('click', () => window.api.maximize());
  document.getElementById('btn-win-close')?.addEventListener('click', () => window.api.close());
});
