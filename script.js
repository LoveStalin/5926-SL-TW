const classData = {
    "10A5": {
        memoryImage: "image/5-9.jpg",
        memoryAlt: "Khai giảng 10A5",
        year: "Trần Phú • 2025",
        moments: [
            { image: "image/2-9.jpg", title: "Đi xem Mưa Đỏ", details: ["📅 2/9/2025", "📍CGV Vincom Móng Cái", "🎯Đi xem phim tập thể"], link: "https://www.facebook.com/share/p/1T6QBshDWL/" },
            { image: "image/5-9.jpg", title: "Khai Giảng", details: ["📅 5/9/2025", "📍Sân Trường THPT Trần Phú", "🎯Ngày đầu tiên bước chân vào cấp 3 của bọn mình"], link: "https://www.facebook.com/share/p/18B8eFrHcF/" },
            { image: "image/Mid-autumn.jpg", title: "Trung Thu", details: ["📅 6/10/2025", "📍Nhà cô Miêu", "🎯Ăn Trung Thu"], link: "https://www.facebook.com/share/p/176uMHcpKa/" },
            { image: "image/20-10-girl.jpg", title: "20/10 của các bạn nữ 10A5", details: ["📅 20/10/2025", "📍Lớp 10A5", "🎯Tổ chức cho cô và các bạn nữ ngày phụ nữ Việt Nam"], link: "https://www.facebook.com/share/p/1Bp7wY4itt/" },
            { image: "image/20-10-boy.jpg", title: "Các bạn nam cầm hoa tặng các bạn nữ 20/10", details: ["📅 20/10/2025", "📍Lớp 10A5", "🎯Tặng hoa cho các bạn nữ"], link: "https://www.facebook.com/share/p/1Bp7wY4itt/" },
            { image: "image/Chinese-new-year.jpg", title: "Tết Bính Ngọ 2026", details: ["📅 13/02/2025", "📍Sân Trường THPT Trần Phú", "🎯Chụp ảnh Tết 2026-tiễn bạn sì nếch🐍"], link: "https://www.facebook.com/share/p/18JxVehBTx/" },
            { image: "image/8-3.jpg", title: "Ngày Quốc Tế Phụ Nữ", details: ["📅 08/03/2026", "📍Lớp 10A5", "🎯Chúc các bạn nữ lớp 10A5 nhân ngày 8/3"], link: "https://www.facebook.com/share/p/18CstkvDCy/" }
        ]
    },
    "11A5": {
        memoryImage: "image/11A5.jpg",
        memoryAlt: "Memory lớp 11A5",
        year: "Trần Phú • 2026",
        moments: [
            { title: "Khoảnh khắc 11A5", details: ["✨ Gallery đang được cập nhật", "📸 Những kỷ niệm mới đang chờ bạn"], placeholder: true },
            { title: "Our Moments 11A5", details: ["🌟 Một chương mới của A5-K68", "🗓️ Hẹn gặp lại trong những bức ảnh sắp tới"], placeholder: true },
            { title: "Kỷ niệm đang đến", details: ["💜 Nội dung sẽ được bổ sung sớm", "📍Lớp 11A5"], placeholder: true },
            { title: "Memory loading...", details: ["🎞️ Thẻ ảnh cùng kích thước với 10A5", "✨ Chờ những khoảnh khắc thật đẹp"], placeholder: true }
        ]
    }
};

let currentClass = "10A5";

function createPhotoCard(moment) {
    const card = document.createElement("div");
    card.className = `photo-card${moment.placeholder ? " placeholder-card" : ""}`;
    const imageContent = moment.placeholder
        ? `<div class="placeholder-art"><span>11A5</span><small>Coming soon</small></div>`
        : `<img src="${moment.image}" alt="${moment.title}">`;
    const details = moment.details.map((detail) => `<p>${detail}</p>`).join("");
    const link = moment.link ? `<a href="${moment.link}" target="_blank" rel="noopener">Xem bài đăng</a>` : "";

    card.innerHTML = `
        <div class="photo-inner">
            <div class="photo-front">${imageContent}</div>
            <div class="photo-back">
                <h3>${moment.title}</h3>
                ${details}
                ${link}
            </div>
        </div>
    `;
    card.addEventListener("click", () => card.classList.toggle("flip"));
    return card;
}

function renderGallery(className) {
    const galleryGrid = document.getElementById("galleryGrid");
    galleryGrid.classList.add("is-changing");
    window.setTimeout(() => {
        galleryGrid.replaceChildren(...classData[className].moments.map(createPhotoCard));
        const cards = galleryGrid.querySelectorAll(".photo-card");
        cards.forEach((card, index) => {
            card.style.transitionDelay = `${index * 0.1}s`;
            galleryObserver.observe(card);
        });
        galleryGrid.classList.remove("is-changing");
        requestAnimationFrame(() => cards.forEach((card) => card.classList.add("show")));
    }, 180);
}

function switchClass(className) {
    if (!classData[className] || className === currentClass) return;
    currentClass = className;
    const selectedClass = classData[className];
    document.getElementById("mainMemoryImage").src = selectedClass.memoryImage;
    document.getElementById("mainMemoryImage").alt = selectedClass.memoryAlt;
    document.getElementById("classEyebrow").textContent = `Class memory • ${className}`;
    document.getElementById("miniClassName").textContent = className;
    document.getElementById("miniClassYear").textContent = selectedClass.year;
    document.getElementById("galleryTitle").textContent = `Những khoảnh khắc đẹp của ${className} ✨`;
    document.getElementById("footerClassName").textContent = `Lớp ${className}`;
    document.querySelectorAll(".class-option").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.class === className);
    });
    renderGallery(className);
}

const galleryObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("show");
    });
}, { threshold: 0.15 });

document.querySelectorAll(".class-option").forEach((button) => {
    button.addEventListener("click", () => switchClass(button.dataset.class));
});

renderGallery(currentClass);

function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active");
}
