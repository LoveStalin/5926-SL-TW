(() => {
    const video = document.getElementById("libraryThemeVideo");
    if (!video) return;

    // Background video is intentionally muted for reliable autoplay.
    // If the browser permits audible autoplay, we still keep the experience silent
    // until the user explicitly interacts with the page.
    video.muted = true;
    video.defaultMuted = true;

    const startVideo = () => {
        const promise = video.play();
        if (promise && typeof promise.catch === "function") {
            promise.catch(() => {
                // Autoplay can be blocked by browser policy; the page remains usable.
            });
        }
    };

    startVideo();

    // Once the visitor moves away from the opening hero, keep the video running
    // but make the audio state explicit and visually subordinate.
    let scrolled = false;
    const updateScrollState = () => {
        const nextScrolled = window.scrollY > Math.min(window.innerHeight * 0.35, 320);
        if (nextScrolled === scrolled) return;
        scrolled = nextScrolled;
        document.body.classList.toggle("video-scrolled", scrolled);
        if (scrolled) {
            video.muted = true;
            video.volume = 0;
        }
    };

    window.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();

    // Fade library sections into view as they enter the viewport.
    const revealTargets = [
        document.getElementById("bookshelfSection"),
        document.getElementById("librarySection"),
        document.getElementById("authSection"),
        document.querySelector(".site-footer")
    ].filter(Boolean);

    revealTargets.forEach((element, index) => {
        element.classList.add("reveal-on-scroll");
        element.style.transitionDelay = Math.min(index * 80, 240) + "ms";
    });

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries, currentObserver) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                currentObserver.unobserve(entry.target);
            });
        }, {
            threshold: 0.12,
            rootMargin: "0px 0px -8% 0px"
        });

        revealTargets.forEach(element => observer.observe(element));
    } else {
        revealTargets.forEach(element => element.classList.add("is-visible"));
    }

    // Respect accessibility preferences.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        video.pause();
        video.removeAttribute("autoplay");
        revealTargets.forEach(element => element.classList.add("is-visible"));
    }
})();
