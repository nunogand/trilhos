/**
 * Scroll infinito para listas paginadas (jekyll-paginate).
 *
 * Melhoria progressiva: sem JavaScript, o botão é uma ligação normal para a página seguinte.
 * Com JavaScript, vai buscar essa página, copia os cartões para a lista atual e atualiza a ligação.
 *
 * Marcação esperada (ver index.html):
 *   #post-cards                     lista onde os cartões são acrescentados
 *   #load-more-nav[data-auto-pages] contentor do botão (nº de carregamentos automáticos antes de exigir clique)
 *   #load-more                      <a rel="next" href="..."> para a página seguinte
 *   #load-status                    região aria-live para avisos
 */
(() => {
  const list = document.getElementById("post-cards");
  const nav = document.getElementById("load-more-nav");
  const link = document.getElementById("load-more");
  const status = document.getElementById("load-status");
  if (!list || !nav || !link || !("IntersectionObserver" in window)) return; // fica a paginação normal

  const MAX_AUTO = Number(nav.dataset.autoPages ?? 3); // depois disto, só ao clicar (o rodapé continua acessível)
  const LABEL = link.textContent;
  let autoLoads = 0, loading = false;

  const announce = msg => { status.textContent = ""; status.textContent = msg; };

  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { autoLoads++; loadNext(); }
  }, { rootMargin: "0px 0px 600px 0px" }); // começa a carregar antes de o botão chegar ao ecrã

  function watch() {
    // Reobservar força nova verificação (se a página ficar curta, o botão continuaria visível e nada dispararia)
    observer.unobserve(nav);
    if (autoLoads < MAX_AUTO) observer.observe(nav);
  }

  async function loadNext() {
    if (loading) return;
    loading = true;
    nav.setAttribute("aria-busy", "true");
    link.textContent = "A carregar…";
    try {
      const res = await fetch(link.href, { headers: { Accept: "text/html" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");

      const cards = Array.from(doc.querySelectorAll("#post-cards > .post-card"));
      const frag = document.createDocumentFragment();
      cards.forEach(card => {
        const node = document.importNode(card, true);
        node.classList.add("is-new");
        frag.appendChild(node);
      });
      list.appendChild(frag);

      const next = doc.getElementById("load-more");
      if (next) {
        link.href = new URL(next.getAttribute("href"), link.href).href; // resolvido a partir da página lida
        link.textContent = LABEL;
        announce(`${cards.length} publicações carregadas.`);
        watch();
      } else {
        observer.disconnect();
        nav.remove();
        announce(`${cards.length} publicações carregadas. Não há mais publicações.`);
      }
    } catch (err) {
      console.error(err);
      observer.disconnect();
      link.textContent = "Tentar novamente";
      announce("Não foi possível carregar mais publicações.");
    } finally {
      loading = false;
      nav.removeAttribute("aria-busy");
    }
  }

  link.addEventListener("click", e => { e.preventDefault(); loadNext(); });
  watch();
})();
