(() => {
    const video = document.getElementById("libraryThemeVideo");
    if (!video) return;

    // Use the local Worker only when the page is opened with ?api=local.
    const workerBase = new URLSearchParams(window.location.search).get("api") === "local"
        ? "http://127.0.0.1:8787"
        : "https://a5-digital-library-api.thanhnguyenxuan917.workers.dev";
    video.src = workerBase.replace(/\/$/, "") + "/api/v1/theme/video";

    // Fall back to muted playback if the browser blocks audio autoplay.
    video.defaultMuted = false;

    const startVideo = async () => {
        video.muted = false;
        try {
            await video.play();
        } catch {
            video.muted = true;
            try {
                await video.play();
            } catch {
                // Playback can wait for a user gesture.
            }
        }
    };

    startVideo();

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

    // Reveal each section as it enters the viewport.
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

    // Disable motion when the user requests it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        video.pause();
        video.removeAttribute("autoplay");
        revealTargets.forEach(element => element.classList.add("is-visible"));
    }
})();
