document.querySelectorAll('.photo-card').forEach(card => {
    card.addEventListener('click', () => {
        card.classList.toggle('flip');
    });
});
//transition on card
const cards = document.querySelectorAll('.photo-card');

cards.forEach((card, index) => {
    card.style.transitionDelay = index * 0.15 + "s";
});

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show');
        }
    });
}, {
    threshold: 0.15
});

cards.forEach(card => observer.observe(card));
//Ham bơ gơ ngon quá!
function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active");
}