const themeStorageKey = "a5-k68-theme";
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;

    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    const isDark = theme === "dark";
    toggle.textContent = isDark ? "☀" : "☾";
    toggle.setAttribute("aria-label", isDark ? "Chuyển sang nền sáng" : "Chuyển sang nền tối");
    toggle.setAttribute("title", isDark ? "Chuyển sang nền sáng" : "Chuyển sang nền tối");
}

const savedTheme = window.localStorage.getItem(themeStorageKey)
    || window.localStorage.getItem("dashboard-theme");
applyTheme(savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : (systemTheme.matches ? "dark" : "light"));

document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-theme-toggle]");
    if (!toggle) return;

    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
});

systemTheme.addEventListener("change", (event) => {
    if (!window.localStorage.getItem(themeStorageKey)) {
        applyTheme(event.matches ? "dark" : "light");
    }
});
