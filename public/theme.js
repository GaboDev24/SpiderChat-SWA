/**
 * SpiderChat — Toggle de Tema Oscuro/Claro
 * Se carga antes del DOM para evitar FOUC (flash of unstyled content)
 */
(function () {
  const stored = localStorage.getItem('sc-theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = stored || (prefersLight ? 'light' : 'dark');

  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  window.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    function updateIcon(t) {
      btn.innerHTML = t === 'light'
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';
    }
    updateIcon(theme);

    btn.addEventListener('click', function () {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const next = isLight ? 'dark' : 'light';
      if (next === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem('sc-theme', next);
      updateIcon(next);

      // Actualizar logos segun el tema
      document.querySelectorAll('[data-logo-swap]').forEach(function (img) {
        img.src = next === 'light' ? img.dataset.logoLight : img.dataset.logoDark;
      });
    });
  });
})();
