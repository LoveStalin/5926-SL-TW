let localLeft = [];
let localMiddle = [];
let localRight = [];
import { db, ref, set, onValue } from "./firebase.js";
console.log("render is running");
import { auth, provider } from "./firebase.js";
import { signInWithPopup, signOut }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { defaultSeatmap } from "./seatmap.js";

let isTeacher = false;
let container = null;
let touchSeatId = null;

function renderRow(left, middle, right) {

    if (!Array.isArray(left)) left = [];
    if (!Array.isArray(middle)) middle = [];
    if (!Array.isArray(right)) right = [];
    const fullRow = [
        ...left,
        "AISLE",
        ...middle,
        "AISLE",
        ...right
    ];

    fullRow.forEach((seat, index) => {

        const div = document.createElement("div");

        if (seat === "AISLE") {
            div.className = "aisle";
        }

        else if (!seat) {

            div.className = "empty-seat";

            div.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            div.addEventListener("drop", (e) => {

                const fromId = e.dataTransfer.getData("seatId");

                let targetRow;
                let targetIndex;

                if (index < left.length) {
                    targetRow = left;
                    targetIndex = index;
                }
                else if (index === left.length) {
                    return; // AISLE
                }
                else if (index < left.length + 1 + middle.length) {
                    targetRow = middle;
                    targetIndex = index - left.length - 1;
                }
                else if (index === left.length + 1 + middle.length) {
                    return; // AISLE
                }
                else {
                    targetRow = right;
                    targetIndex = index - left.length - middle.length - 2;
                }

                moveToEmpty(fromId, targetRow, targetIndex);

            });

            // Touch drop target for mobile
            div.addEventListener("touchstart", () => {
                // no-op, needed so touchend fires on this element
            }, { passive: true });

            div.addEventListener("touchend", (e) => {
                if (!isTeacher || !touchSeatId) return;
                if (e.cancelable) e.preventDefault();
                moveToEmpty(touchSeatId, targetRow, targetIndex);
                touchSeatId = null;
            }, { passive: false });

        }

        else {
            const student = students[seat];

            if (!student) {
                console.warn("Không tìm thấy student:", seat);
                div.className = "empty-seat";
                if (container) container.appendChild(div);
                return;
            }

            div.className = "seat";
            div.dataset.seatId = seat;
            div.draggable = isTeacher;
            div.addEventListener("dragstart", (e) => {
                e.dataTransfer.setData("seatId", seat);
            });

            div.addEventListener("dragover", (e) => {
                e.preventDefault();
            });
            div.addEventListener("drop", (e) => {

                const fromId = e.dataTransfer.getData("seatId");
                const toId = div.dataset.seatId;

                swapSeats(fromId, toId);

            });

            div.innerHTML = `
    <div class="avatar-wrapper">
        <img src="${student.img}" class="avatar">
    </div>

    <div class="seat-info">
        <p class="name">${student.displayName}</p>
        ${student.role ? `<p class="role">${student.role}</p>` : ""}
    </div>
`;

            div.addEventListener("click", () => {
                openProfile(seat);
            });

            // Touch drag for mobile
            div.addEventListener("touchstart", (e) => {
                if (!isTeacher) return;
                touchSeatId = seat;
            }, { passive: true });

            div.addEventListener("touchend", (e) => {
                if (!isTeacher || !touchSeatId) return;
                if (e.cancelable) e.preventDefault();
                const fromId = touchSeatId;
                const toId = div.dataset.seatId;
                if (fromId !== toId) {
                    swapSeats(fromId, toId);
                }
                touchSeatId = null;
            }, { passive: false });

            div.addEventListener("touchcancel", () => {
                touchSeatId = null;
            });
        }

        if (container) container.appendChild(div);
    });
}

function renderAll() {
    if (!container) return;

    container.innerHTML = "";

    const totalRows = Math.max(
        localLeft.length,
        localMiddle.length,
        localRight.length
    );

    for (let i = 0; i < totalRows; i++) {
        renderRow(
            localLeft[i] || [],
            localMiddle[i] || [],
            localRight[i] || []
        );
    }
}


const ensureShape = (block, template) => {
    const cols = template[0]?.length || 0;
    const rows = Math.max(
        template.length,
        Array.isArray(block) ? block.length : Object.keys(block || {}).length
    );
    const safeBlock = block || [];

    const readRow = (r) => {
        if (Array.isArray(safeBlock)) return safeBlock[r];
        return safeBlock[r];
    };

    const toArrayRow = (row) => {
        if (!row) return Array(cols).fill(null);
        const res = [];
        for (let c = 0; c < cols; c++) {
            if (Array.isArray(row)) res.push(row[c] ?? null);
            else res.push(row[c] ?? null); // object with numeric keys
        }
        return res;
    };

    const result = [];
    for (let r = 0; r < rows; r++) {
        result.push(toArrayRow(readRow(r)));
    }
    return result;
};

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("loginBtn").addEventListener("click", async () => {
        try {
            const result = await signInWithPopup(auth, provider);

            const user = result.user;

            console.log(user.email);

            if (
                user.email === "devthanh280625@gmail.com" ||
                user.email === "hlee95095@gmail.com"
            ) {
                isTeacher = true;
                alert("Teacher mode activated");
            } else {
                isTeacher = false;
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Login failed hoặc popup bị chặn!");
        }
    });
    container = document.getElementById("seatmap");

    if (!container) {
        console.error("Không tìm thấy container seatmap");
        return;
    }


    onAuthStateChanged(auth, (user) => {

        if (user &&
            (user.email === "devthanh280625@gmail.com" ||
                user.email === "hlee95095@gmail.com")
        ) {
            isTeacher = true;
        } else {
            isTeacher = false;
        }
        updateWelcome(user);
    });

    // Legacy copy kept temporarily; main renderRow is defined globally above.
    function renderRowLegacy(left, middle, right) {

        if (!Array.isArray(left)) left = [];
        if (!Array.isArray(middle)) middle = [];
        if (!Array.isArray(right)) right = [];
        const fullRow = [
            ...left,
            "AISLE",
            ...middle,
            "AISLE",
            ...right
        ];

        fullRow.forEach((seat, index) => {

            const div = document.createElement("div");

            if (seat === "AISLE") {
                div.className = "aisle";
            }

            else if (!seat) {

                div.className = "empty-seat";

                div.addEventListener("dragover", (e) => {
                    e.preventDefault();
                });

                div.addEventListener("drop", (e) => {

                    const fromId = e.dataTransfer.getData("seatId");

                    let targetRow;
                    let targetIndex;

                    if (index < left.length) {
                        targetRow = left;
                        targetIndex = index;
                    }
                    else if (index === left.length) {
                        return; // AISLE
                    }
                    else if (index < left.length + 1 + middle.length) {
                        targetRow = middle;
                        targetIndex = index - left.length - 1;
                    }
                    else if (index === left.length + 1 + middle.length) {
                        return; // AISLE
                    }
                    else {
                        targetRow = right;
                        targetIndex = index - left.length - middle.length - 2;
                    }

                    moveToEmpty(fromId, targetRow, targetIndex);

                });

            }

            else {
                const student = students[seat];

                if (!student) {
                    console.warn("Không tìm thấy student:", seat);
                    div.className = "empty-seat";
                    container.appendChild(div);
                    return;
                }

                div.className = "seat";
                div.dataset.seatId = seat;
                div.draggable = isTeacher;
                div.addEventListener("dragstart", (e) => {
                    e.dataTransfer.setData("seatId", seat);
                });

                div.addEventListener("dragover", (e) => {
                    e.preventDefault();
                });
                div.addEventListener("drop", (e) => {

                    const fromId = e.dataTransfer.getData("seatId");
                    const toId = div.dataset.seatId;

                    swapSeats(fromId, toId);

                });

                div.innerHTML = `
    <div class="avatar-wrapper">
        <img src="${student.img}" class="avatar">
    </div>

    <div class="seat-info">
        <p class="name">${student.displayName}</p>
        ${student.role ? `<p class="role">${student.role}</p>` : ""}
    </div>
`;

                div.addEventListener("click", () => {
                    openProfile(student);
                });
            }

            container.appendChild(div);
        });
    }
    onValue(ref(db, "seatmap"), (snapshot) => {

        let data = snapshot.val();
        if (!data) return;

        localLeft = ensureShape(data.leftBlock, defaultSeatmap.leftBlock);
        localMiddle = ensureShape(data.middleBlock, defaultSeatmap.middleBlock);
        localRight = ensureShape(data.rightBlock, defaultSeatmap.rightBlock);

        renderAll();

    });


});
const ROLE_LIBRARY = Object.freeze([
    "XUNG KÍCH",
    "Lớp phó lao động",
    "Tổ trưởng Tổ 1",
    "Tổ trưởng Tổ 2",
    "Tổ trưởng Tổ 3",
    "Bí Thư",
    "Lớp trưởng",
    "Lớp phó học tập",
    "Lớp phó văn thể",
    "Lớp phó đời sống",
    "Thủ quỹ",
    "Lớp phó lao động",
    "Lớp phó học tập-Lớp phó đời sống-Thủ quỹ"
].sort());

function getAvailableRoles() {
    return [...ROLE_LIBRARY];
}

function assignStudentRole(studentId, selectedRole) {
    if (!studentId || !selectedRole) return;

    const targetStudent = students[studentId];
    if (!targetStudent) return;

    if (selectedRole === "__clear__") {
        delete targetStudent.role;
        renderAll();
        return;
    }

    for (const [id, student] of Object.entries(students)) {
        if (id !== studentId && student.role === selectedRole) {
            delete student.role;
        }
    }

    targetStudent.role = selectedRole;
    renderAll();
}

//Another Function
function openProfile(studentId) {
    const student = students[studentId];
    if (!student) return;

    const popup = document.getElementById("profilePopup");
    const availableRoles = getAvailableRoles();
    const selectedRole = student.role || "";

    popup.innerHTML = `
        <div class="popup-content">
            <button class="close-popup" aria-label="Đóng popup">✕</button>

            <div class="profile-header">
                <img src="${student.img}" class="student-avatar">
                <div class="profile-main">
                    <span class="profile-tag">Thông tin học sinh</span>
                    <h2>${student.fullName}</h2>
                    <div class="role-badge">${student.role || "Chưa có chức vụ"}</div>
                </div>
            </div>

            <div class="profile-body">
                <p><strong>Ngày sinh:</strong> ${student.dob}</p>
                <p><strong>Họ tên hiển thị:</strong> ${student.displayName}</p>
                <p><strong>Chức vụ hiện tại:</strong> ${student.role || "Chưa được bổ nhiệm"}</p>
            </div>

            ${isTeacher ? `
                <div class="role-manager">
                    <label for="roleSelect">Bổ nhiệm chức vụ</label>
                    <select id="roleSelect">
                        <option value="__clear__">Xóa chức vụ</option>
                        ${availableRoles.map((role) => `
                            <option value="${role}" ${role === selectedRole ? "selected" : ""}>${role}</option>
                        `).join("")}
                    </select>
                    <button id="assignRoleBtn" class="assign-role-btn">Bổ nhiệm chức vụ</button>
                </div>
            ` : ""}

            <button class="close-popup secondary">Đóng</button>
        </div>
    `;

    popup.style.display = "flex";

    const closeButtons = popup.querySelectorAll(".close-popup");
    closeButtons.forEach((btn) => {
        btn.addEventListener("click", function () {
            popup.style.display = "none";
        });
    });

    const assignRoleBtn = document.getElementById("assignRoleBtn");
    if (assignRoleBtn) {
        assignRoleBtn.addEventListener("click", () => {
            const roleSelect = document.getElementById("roleSelect");
            if (!roleSelect) return;

            const chosenRole = roleSelect.value;
            if (!chosenRole) return;

            assignStudentRole(studentId, chosenRole);
            openProfile(studentId);
        });
    }
}
function swapSeats(a, b) {

    if (!isTeacher) return;
    if (a === b) return;

    const blocks = [localLeft, localMiddle, localRight];

    console.log("swap:", a, b);

    for (let block of blocks) {
        for (let row of block) {
            for (let i = 0; i < row.length; i++) {

                if (row[i] === a) row[i] = b;
                else if (row[i] === b) row[i] = a;

            }
        }
    }

    renderAll();
}
function moveToEmpty(id, targetRow, targetIndex) {
    console.log("MOVE DEBUG:");
    console.log("student:", id);
    console.log("targetRow:", targetRow);
    console.log("targetIndex:", targetIndex);

    const blocks = [localLeft, localMiddle, localRight];

    let sourceRow = null;
    let sourceIndex = null;

    for (let block of blocks) {
        for (let row of block) {
            for (let i = 0; i < row.length; i++) {

                if (row[i] === id) {
                    sourceRow = row;
                    sourceIndex = i;
                }

            }
        }
    }

    if (sourceRow && targetRow && targetRow[targetIndex] == null) {
        sourceRow[sourceIndex] = null;
        targetRow[targetIndex] = id;
        renderAll();

    }

}

function changeSeatRows() {

    if (!isTeacher) {
        alert("Only teacher can change seat rows");
        return;
    }

    const nextLeft = JSON.parse(JSON.stringify(localMiddle));
    const nextMiddle = JSON.parse(JSON.stringify(localRight));
    const nextRight = JSON.parse(JSON.stringify(localLeft));

    localLeft = nextLeft;
    localMiddle = nextMiddle;
    localRight = nextRight;

    renderAll();
    saveSeatmap();
}

function resetSeatmap() {

    if (!isTeacher) return;

    localLeft = JSON.parse(JSON.stringify(defaultSeatmap.leftBlock));
    localMiddle = JSON.parse(JSON.stringify(defaultSeatmap.middleBlock));
    localRight = JSON.parse(JSON.stringify(defaultSeatmap.rightBlock));

    renderAll();

}
function saveSeatmap() {

    if (!isTeacher) {
        alert("Only teacher can save");
        return;
    }

    set(ref(db, "seatmap"), {
        leftBlock: ensureShape(localLeft, defaultSeatmap.leftBlock),
        middleBlock: ensureShape(localMiddle, defaultSeatmap.middleBlock),
        rightBlock: ensureShape(localRight, defaultSeatmap.rightBlock)
    });

}
document.getElementById("saveSeat").addEventListener("click", saveSeatmap);

document.getElementById("logoutBtn").addEventListener("click", async () => {

    await signOut(auth);
    updateWelcome(null);

    isTeacher = false;

    alert("Logged out");

    location.reload();
});
function updateWelcome(user) {

    const box = document.getElementById("welcome-card");

    if (!user) {
        box.innerHTML = "";
        return;
    }

    const role = isTeacher ? "Teacher 👩‍🏫" : "Student 👨‍🎓";

    box.innerHTML = `
      <div id="welcome-card">

        <div class="welcome-text">
          <div class="welcome-title">
            Welcome back, <b>${user.displayName}</b>
          </div>

          <div class="role">
            Your role: <b>${role}</b>
          </div>
         </div>

    <img src="${user.photoURL}" class="user-avatar">

</div>
`;
}

document.getElementById("resetSeat").addEventListener("click", resetSeatmap);
document.getElementById("changeSeatRowBtn").addEventListener("click", changeSeatRows);