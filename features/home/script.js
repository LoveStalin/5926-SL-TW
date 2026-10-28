const classData = {
    "10A5": {
        memoryImage: "/assets/images/5-9.jpg",
        memoryAlt: "Khai giảng 10A5",
        year: "Trần Phú • 2025",
        moments: [
            { image: "/assets/images/2-9.jpg", title: "Đi xem Mưa Đỏ", details: ["📅 2/9/2025", "📍CGV Vincom Móng Cái", "🎯Đi xem phim tập thể"], en: { title: "Watching Red Rain", details: ["📅 2 Sep 2025", "📍CGV Vincom Mong Cai", "🎯A class movie outing"] }, link: "https://www.facebook.com/share/p/1T6QBshDWL/" },
            { image: "/assets/images/5-9.jpg", title: "Khai Giảng", details: ["📅 5/9/2025", "📍Sân Trường THPT Trần Phú", "🎯Ngày đầu tiên bước chân vào cấp 3 của bọn mình"], en: { title: "Opening Ceremony", details: ["📅 5 Sep 2025", "📍Tran Phu High School courtyard", "🎯Our first day of high school"] }, link: "https://www.facebook.com/share/p/18B8eFrHcF/" },
            { image: "/assets/images/Mid-autumn.jpg", title: "Trung Thu", details: ["📅 6/10/2025", "📍Nhà cô Miêu", "🎯Ăn Trung Thu"], en: { title: "Mid-Autumn Festival", details: ["📅 6 Oct 2025", "📍Ms. Mieu's house", "🎯Celebrating the Mid-Autumn Festival"] }, link: "https://www.facebook.com/share/p/176uMHcpKa/" },
            { image: "/assets/images/20-10-girl.jpg", title: "20/10 của các bạn nữ 10A5", details: ["📅 20/10/2025", "📍Lớp 10A5", "🎯Tổ chức cho cô và các bạn nữ ngày phụ nữ Việt Nam"], en: { title: "Celebrating the 10A5 Girls", details: ["📅 20 Oct 2025", "📍Class 10A5", "🎯Celebrating our teacher and classmates on Vietnamese Women's Day"] }, link: "https://www.facebook.com/share/p/1Bp7wY4itt/" },
            { image: "/assets/images/20-10-boy.jpg", title: "Các bạn nam cầm hoa tặng các bạn nữ 20/10", details: ["📅 20/10/2025", "📍Lớp 10A5", "🎯Tặng hoa cho các bạn nữ"], en: { title: "Flowers for the Girls", details: ["📅 20 Oct 2025", "📍Class 10A5", "🎯The boys give flowers to their classmates"] }, link: "https://www.facebook.com/share/p/1Bp7wY4itt/" },
            { image: "/assets/images/Chinese-new-year.jpg", title: "Tết Bính Ngọ 2026", details: ["📅 13/02/2025", "📍Sân Trường THPT Trần Phú", "🎯Chụp ảnh Tết 2026-tiễn bạn sì nếch🐍"], en: { title: "Year of the Horse 2026", details: ["📅 13 Feb 2026", "📍Tran Phu High School courtyard", "🎯Lunar New Year photos and a farewell to our Snake friend 🐍"] }, link: "https://www.facebook.com/share/p/18JxVehBTx/" },
            { image: "/assets/images/8-3.jpg", title: "Ngày Quốc Tế Phụ Nữ", details: ["📅 08/03/2026", "📍Lớp 10A5", "🎯Chúc các bạn nữ lớp 10A5 nhân ngày 8/3"], en: { title: "International Women's Day", details: ["📅 8 Mar 2026", "📍Class 10A5", "🎯Celebrating the girls of class 10A5 on March 8"] }, link: "https://www.facebook.com/share/p/18CstkvDCy/" },
            { image: "/assets/images/hoi-thanh-nien-khoe-2026.jpg", title: "Hội Thanh Niên Khỏe 2026", details: ["📅 14/03/2026", "📍Sân Trường THPT Trần Phú", "🎯Tham gia Hội Thanh Niên Khỏe 2026"], en: { title: "Youth Sports Festival 2026", details: ["📅 14 Mar 2026", "📍Tran Phu High School courtyard", "🎯Taking part in the 2026 Youth Sports Festival"] }, link: "https://www.facebook.com/share/p/14w7LASZb8M/" },
        ]
    },
    "11A5": {
        memoryImage: "/assets/images/11A5.jpg",
        memoryAlt: "Memory lớp 11A5",
        year: "Trần Phú • 2026",
        moments: [
            { image:"/assets/images/20-10-2026.jpg", title: "Chúc mừng 20/10 năm thứ 2🫰", details: ["📅 20/10/2026", "📍 Lớp 11A5"], en: { title: "Celebrating October 20 for the second year 🫰", details: ["📅 20 Oct 2026", "📍 Class 11A5"] }, link: "https://www.facebook.com/share/r/19jvCLZR4H/" },
            { title: "PLAYOFF Week 1", details: ["DALLAS GÀ QUÁAAAA", "Ceedee Lamb biết chơi không vậy?"], en: { title: "PLAYOFF Week 1", details: ["Dallas, you are so bad!", "Does CeeDee Lamb know how to play?"] }, placeholder: true },
            { title: "NGỦ", details: ["TAO BUỒN NGỦ", "TAO MUỐN NGỦ"], en: { title: "SLEEP", details: ["I'M SO SLEEPY", "I WANT TO SLEEP"] }, placeholder: true },
            { title: "THÈM MỲ QUÁ", details: ["GIỜ LẠI THẤY ĐÓI", "NẤU CHO TAO BÁT MỲ ĐI"], en: { title: "CRAVING NOODLES", details: ["Now I'm hungry again", "Make me a bowl of noodles!"] }, placeholder: true }
        ]
    }
};

let currentClass = "10A5";
const translations = {
    vi: {
        menuSeats: "Sơ đồ lớp", menuMoments: "Khoảnh khắc", menuContact: "Liên hệ", menuAccount: "Tài khoản lớp",
        welcome: "Chào mừng đến với A5-K68",
        heroText: "Xin chào mọi người, chúng mình là Eternal Tiger - Biệt đội Hổ báo🐯. “Eternal Tiger” là những chú hổ bất diệt với tinh thần mạnh mẽ, mãnh liệt, bất khuất, kiên cường!💪💪💪. Đây là lời chào đầu tiên của A5 tới mọi người",
        viewMoments: "Xem khoảnh khắc", viewSeats: "Sơ đồ lớp", classAccount: "Tài khoản lớp",
        milestones: "mốc đáng nhớ", community: "tập thể gắn kết", memories: "kỷ niệm", classMemory: "Kỷ niệm lớp",
        chooseClass: "Chọn lớp", ourMoments: "Khoảnh khắc của chúng mình", info: "THÔNG TIN", address: "Địa chỉ: Phòng 27 - Gần Trung tâm tầng 3 - Dãy 5 tầng - Trường THPT Trần Phú",
        management: "QUẢN LÝ", itClub: "Hiệp hội ITers A5-K68", classLeaders: "Các \"quan chức\" trong hệ thống chính trị A5-K68", tigers: "Hổ báo trường Trần Phú",
        contactTeacher: "LIÊN HỆ QUA CÔ CHỦ NHIỆM", zalo: "Zalo: 0378003888", postLink: "Xem bài đăng", comingSoon: "Sắp ra mắt",
        galleryTitle: (name) => `Những khoảnh khắc đẹp của ${name} ✨`, classLabel: (name) => `Kỷ niệm lớp • ${name}`,
        className: (name) => `Lớp ${name}`, switchLabel: "Chuyển ngôn ngữ sang tiếng Anh"
    },
    en: {
        menuSeats: "Seating Chart", menuMoments: "Moments", menuContact: "Contact", menuAccount: "Class Account",
        welcome: "Welcome to A5-K68",
        heroText: "Hello everyone! We are Eternal Tiger - the fearless tiger squad 🐯. Eternal Tigers are strong, passionate, indomitable, and resilient! 💪💪💪 This is A5's first greeting to you all.",
        viewMoments: "Explore our moments", viewSeats: "Seating chart", classAccount: "Class account",
        milestones: "memorable milestones", community: "one close-knit class", memories: "memories", classMemory: "Class memories",
        chooseClass: "Choose a class", ourMoments: "Our Moments", info: "INFORMATION", address: "Address: Room 27, near the 3rd-floor center, 5-storey building, Tran Phu High School",
        management: "MANAGEMENT", itClub: "A5-K68 ITers Association", classLeaders: "The A5-K68 student leadership team", tigers: "Tran Phu's fearless tigers",
        contactTeacher: "CONTACT OUR HOMEROOM TEACHER", zalo: "Zalo: 0378003888", postLink: "View post", comingSoon: "Coming soon",
        galleryTitle: (name) => `Beautiful moments of ${name} ✨`, classLabel: (name) => `Class memories • ${name}`,
        className: (name) => `Class ${name}`, switchLabel: "Chuyển ngôn ngữ sang tiếng Việt"
    }
};
let currentLanguage = localStorage.getItem("homeLanguage") === "en" ? "en" : "vi";

function setLanguage(language) {
    currentLanguage = language;
    const text = translations[language];
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.dataset.i18n;
        element.textContent = text[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
        element.setAttribute("aria-label", text[element.dataset.i18nAria]);
    });
    document.getElementById("classEyebrow").textContent = text.classLabel(currentClass);
    document.getElementById("galleryTitle").textContent = text.galleryTitle(currentClass);
    document.getElementById("footerClassName").textContent = text.className(currentClass);

    const flag = document.getElementById("languageFlag");
    const toggle = document.getElementById("languageToggle");
    const targetLanguage = language === "vi" ? "en" : "vi";
    flag.src = targetLanguage === "en" ? "assets/images/eng-flag.jpg" : "assets/images/viet-flag.png";
    flag.alt = targetLanguage === "en" ? "English" : "Tiếng Việt";
    toggle.setAttribute("aria-label", text.switchLabel);
    localStorage.setItem("homeLanguage", language);
    renderGallery(currentClass);
}

function createPhotoCard(moment) {
    const localizedMoment = currentLanguage === "en" && moment.en
        ? { ...moment, ...moment.en }
        : moment;
    const card = document.createElement("div");
    card.className = `photo-card${localizedMoment.placeholder ? " placeholder-card" : ""}`;
    const imageContent = localizedMoment.placeholder
        ? `<div class="placeholder-art"><span>11A5</span><small>${translations[currentLanguage].comingSoon}</small></div>`
        : `<img src="${localizedMoment.image}" alt="${localizedMoment.title}">`;
    const details = localizedMoment.details.map((detail) => `<p>${detail}</p>`).join("");
    const link = localizedMoment.link ? `<a href="${localizedMoment.link}" target="_blank" rel="noopener">${translations[currentLanguage].postLink}</a>` : "";

    card.innerHTML = `
        <div class="photo-inner">
            <div class="photo-front">${imageContent}</div>
            <div class="photo-back">
                <h3>${localizedMoment.title}</h3>
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
    document.getElementById("classEyebrow").textContent = translations[currentLanguage].classLabel(className);
    document.getElementById("miniClassName").textContent = className;
    document.getElementById("miniClassYear").textContent = selectedClass.year;
    document.getElementById("galleryTitle").textContent = translations[currentLanguage].galleryTitle(className);
    document.getElementById("footerClassName").textContent = translations[currentLanguage].className(className);
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

document.getElementById("languageToggle").addEventListener("click", () => {
    setLanguage(currentLanguage === "vi" ? "en" : "vi");
});
setLanguage(currentLanguage);

function toggleMenu() {
    document.getElementById("sideMenu").classList.toggle("active");
}

const heroVisual = document.querySelector(".hero-visual");
const mainCard = document.querySelector(".card-main");

if (heroVisual && mainCard && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroVisual.addEventListener("pointermove", (event) => {
        const bounds = heroVisual.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        mainCard.style.transform = `translate(${x * 10}px, ${y * 10}px) rotate(${x * 5 - 4}deg)`;
    });

    heroVisual.addEventListener("pointerleave", () => {
        mainCard.style.transform = "";
    });
}
