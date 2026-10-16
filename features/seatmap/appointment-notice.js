import { db, ref, set, onValue } from "./firebase.js";
import { auth } from "./firebase.js";

(() => {
    const ticker = document.getElementById("appointmentTicker");
    if (!ticker) return;

    // Keep this list aligned with the teacher allowlist in render.js.
    const teacherEmails = new Set([
        "devthanh280625@gmail.com",
        "hlee95095@gmail.com",
        "cuonghaminhsang@gmail.com"
    ]);

    const EMPTY_MESSAGE = "Không có vị trí nào được chuyển giao trong tháng này";
    let expiryTimer = null;

    function addOneCalendarMonth(timestamp) {
        const date = new Date(timestamp);
        const originalDay = date.getDate();

        date.setDate(1);
        date.setMonth(date.getMonth() + 1);

        const lastDayOfTargetMonth = new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
        ).getDate();

        date.setDate(Math.min(originalDay, lastDayOfTargetMonth));
        return date.getTime();
    }

    function renderEmptyState() {
        ticker.textContent = EMPTY_MESSAGE;
        ticker.classList.add("is-empty");
        ticker.style.animation = "none";
        ticker.style.paddingLeft = "0";
    }

    function renderNotice(notice) {
        if (expiryTimer) {
            clearTimeout(expiryTimer);
            expiryTimer = null;
        }

        if (
            !notice ||
            !notice.studentId ||
            !notice.role ||
            !Number.isFinite(Number(notice.createdAt)) ||
            !Number.isFinite(Number(notice.expiresAt)) ||
            Date.now() >= Number(notice.expiresAt)
        ) {
            renderEmptyState();
            return;
        }

        const student = students[notice.studentId];
        if (!student) {
            renderEmptyState();
            return;
        }

        const [day, month] = String(notice.decisionDate || "").split("/");
        if (!day || !month) {
            renderEmptyState();
            return;
        }

        const decisionNumber = `${day}${month}`;
        const studentName = student.displayName;
        ticker.textContent =
            `Theo Quyết định số ${decisionNumber} của A5-K68, học sinh ${studentName}, ` +
            `được bổ nhiệm chức vụ ${notice.role}. Chúc ${studentName} nhiệm kỳ mới tốt đẹp!`;

        ticker.classList.remove("is-empty");
        ticker.style.paddingLeft = "100%";
        ticker.style.animation = "none";
        void ticker.offsetWidth;
        ticker.style.animation = "";

        const remaining = Number(notice.expiresAt) - Date.now();
        expiryTimer = setTimeout(renderEmptyState, Math.min(remaining, 2147483647));
    }

    // Realtime listener: every visitor sees the same current appointment.
    onValue(ref(db, "appointmentNotice/current"), (snapshot) => {
        renderNotice(snapshot.val());
    }, (error) => {
        console.error("Không thể tải thông báo bổ nhiệm:", error);
        renderEmptyState();
    });

    // Listen to the existing teacher role-assignment UI without changing render.js.
    // The click handler in render.js updates the student's role; this timeout runs
    // after that handler so the latest role map can be saved.
    document.addEventListener("click", (event) => {
        const button = event.target instanceof Element
            ? event.target.closest("#assignRoleBtn")
            : null;

        if (!button) return;

        const user = auth.currentUser;
        if (!user?.email || !teacherEmails.has(user.email.toLowerCase())) return;

        const roleSelect = document.getElementById("roleSelect");
        const selectedRole = roleSelect?.value;
        if (!selectedRole || selectedRole === "__clear__") return;

        const avatar = document.querySelector("#profilePopup .student-avatar");
        const imagePath = avatar?.getAttribute("src");
        const entry = Object.entries(students).find(
            ([, student]) => student.img === imagePath
        );

        if (!entry) {
            console.error("Không xác định được học sinh đang được bổ nhiệm.");
            return;
        }

        const [studentId, studentBefore] = entry;
        const previousRole = studentBefore.role || "";

        // Capture the intended values now; the existing handler will run after this
        // capture listener and update students in memory.
        setTimeout(async () => {
            const studentAfter = students[studentId];
            if (!studentAfter || studentAfter.role !== selectedRole) return;
            if (previousRole === selectedRole) return;

            const createdAt = Date.now();
            const decisionDate = new Intl.DateTimeFormat("vi-VN", {
                day: "2-digit",
                month: "2-digit"
            }).format(new Date(createdAt));

            const roleMap = {};
            Object.entries(students).forEach(([id, student]) => {
                if (student?.role) roleMap[id] = student.role;
            });

            const notice = {
                decisionDate,
                studentId,
                role: selectedRole,
                createdAt,
                expiresAt: addOneCalendarMonth(createdAt)
            };

            try {
                // Persist role changes first; only publish the notice if that succeeds.
                await set(ref(db, "studentRoles"), roleMap);
                await set(ref(db, "appointmentNotice/current"), notice);
            } catch (error) {
                console.error("Không thể lưu quyết định bổ nhiệm:", error);
                alert("Không thể lưu quyết định bổ nhiệm. Kiểm tra kết nối hoặc quyền Firebase.");
            }
        }, 0);
    }, true);
})();
