/**
 * Filtros combináveis do arquivo (lógica E: só aparecem os cartões que têm TODAS as etiquetas selecionadas).
 *
 * Marcação esperada (ver tags.html):
 *   #archive-grid > .post-card[data-tags="slug1 slug2"]   cartões
 *   .filter-button[data-filter="slug"] > .filter-count    botões (aria-pressed)
 *   .results-summary · .no-results · .clear-filters       estado e ações
 *   .filter-panel · .filter-heading · .filter-toggle      painel recolhível (mobile)
 *
 * Extras:
 *   - Os contadores mostram quantos resultados teria cada etiqueta se fosse acrescentada à seleção;
 *     etiquetas que dariam 0 resultados ficam desativadas (sem becos sem saída).
 *   - A seleção fica no URL (?etiquetas=rio,floresta), por isso pode ser partilhada ou guardada.
 */
(() => {
  const grid = document.getElementById("archive-grid");
  if (!grid) return;

  const PARAM = "etiquetas";
  const cards = Array.from(grid.querySelectorAll(".post-card")).map(el => ({
    el,
    tags: new Set((el.dataset.tags || "").split(/\s+/).filter(Boolean))
  }));
  const buttons = Array.from(document.querySelectorAll(".filter-button"));
  const summary = document.querySelector(".results-summary");
  const empty = document.querySelector(".no-results");
  const clearBtn = document.querySelector(".clear-filters");
  const panel = document.querySelector(".filter-panel");
  const heading = document.querySelector(".filter-heading");
  const toggle = document.querySelector(".filter-toggle");

  const active = new Set();
  const matches = (card, selected) => [...selected].every(tag => card.tags.has(tag));
  const plural = n => `${n} percurso${n === 1 ? "" : "s"}`;

  function render() {
    const visible = new Set(cards.filter(c => matches(c, active)));
    cards.forEach(c => { c.el.hidden = !visible.has(c); });

    buttons.forEach(btn => {
      const slug = btn.dataset.filter;
      const pressed = active.has(slug);
      // Selecionada: nº de resultados atuais. Não selecionada: resultados se fosse acrescentada.
      const count = pressed
        ? visible.size
        : cards.filter(c => c.tags.has(slug) && matches(c, active)).length;

      btn.setAttribute("aria-pressed", String(pressed));
      btn.disabled = !pressed && count === 0;
      const badge = btn.querySelector(".filter-count");
      if (badge) badge.textContent = count;
    });

    summary.textContent = active.size
      ? `${visible.size} de ${plural(cards.length)}`
      : plural(cards.length);
    empty.hidden = visible.size > 0;
    clearBtn.hidden = active.size === 0;
    syncUrl();
  }

  function syncUrl() {
    const params = new URLSearchParams(location.search);
    const selected = buttons.map(b => b.dataset.filter).filter(slug => active.has(slug)); // ordem estável
    if (selected.length) params.set(PARAM, selected.join(","));
    else params.delete(PARAM);
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? "?" + query : ""}${location.hash}`);
  }

  buttons.forEach(btn => btn.addEventListener("click", () => {
    const slug = btn.dataset.filter;
    if (active.has(slug)) active.delete(slug); else active.add(slug);
    render();
  }));

  clearBtn.addEventListener("click", () => { active.clear(); render(); });

  // Painel recolhível (só tem efeito quando o botão "Mostrar" está visível, em ecrãs pequenos)
  heading?.addEventListener("click", () => {
    if (!toggle || getComputedStyle(toggle).display === "none") return;
    const open = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Ocultar" : "Mostrar";
  });

  // Seleção inicial vinda do URL (ignora etiquetas que não existem)
  const known = new Set(buttons.map(b => b.dataset.filter));
  (new URLSearchParams(location.search).get(PARAM) || "")
    .split(",").filter(slug => known.has(slug)).forEach(slug => active.add(slug));

  render();
})();
