window.TrilhosGallery = {
  init() {
    const gallery = document.querySelector("#gallery-container");
    const modal = document.querySelector("#gallery-modal");
    if (!gallery || !modal) return;

    const buttons = [...gallery.querySelectorAll(".gallery-button")];
    if (!buttons.length) return;

    const modalImage = modal.querySelector("#gallery-modal-image");
    const modalCaption = modal.querySelector("#gallery-modal-caption");
    const modalCounter = modal.querySelector("#gallery-modal-counter");
    const closeButton = modal.querySelector("#gallery-modal-close");
    const previousButton = modal.querySelector("#gallery-modal-prev");
    const nextButton = modal.querySelector("#gallery-modal-next");
    let currentIndex = 0;
    let previousFocus = null;

    const updateModal = () => {
      const button = buttons[currentIndex];
      modalImage.src = button.dataset.gallerySrc;
      modalImage.alt = button.dataset.galleryAlt || "";
      modalCaption.textContent = button.dataset.galleryCaption || "";
      modalCounter.textContent = `${currentIndex + 1} / ${buttons.length}`;
    };

    const openModal = index => {
      currentIndex = index;
      previousFocus = document.activeElement;
      updateModal();
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      closeButton.focus();
    };

    const closeModal = () => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      modalImage.removeAttribute("src");
      previousFocus?.focus();
    };

    const move = direction => {
      currentIndex = (currentIndex + direction + buttons.length) % buttons.length;
      updateModal();
    };

    buttons.forEach((button, index) => button.addEventListener("click", () => openModal(index)));
    closeButton.addEventListener("click", closeModal);
    previousButton.addEventListener("click", () => move(-1));
    nextButton.addEventListener("click", () => move(1));
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });

    document.addEventListener("keydown", event => {
      if (!modal.classList.contains("open")) return;
      if (event.key === "Escape") closeModal();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    });
  }
};
