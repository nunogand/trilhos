document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar");
  const toggle = document.querySelector(".mobile-toggle");
  const menu = document.querySelector(".nav-menu");
  const topButton = document.querySelector(".scroll-to-top");

  const closeMenu = () => {
    toggle?.classList.remove("active");
    menu?.classList.remove("active");
    toggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  };

  toggle?.addEventListener("click", () => {
    const open = !menu.classList.contains("active");
    toggle.classList.toggle("active", open);
    menu.classList.toggle("active", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });

  menu?.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });

  const updateScrollState = () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 40);
    topButton?.classList.toggle("visible", window.scrollY > 300);
  };
  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });
  topButton?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
});
