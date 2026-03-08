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

let isTeacher = false;


document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("loginBtn").addEventListener("click", async () => {

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

    });
    const container = document.getElementById("seatmap");

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

    function renderRow(left, middle, right) {

        const fullRow = [
            ...left,
            "AISLE",
            ...middle,
            "AISLE",
            ...right
        ];

        fullRow.forEach(seat => {

            const div = document.createElement("div");

            if (seat === "AISLE") {
                div.className = "aisle";
            }

            else if (!seat) {
                div.className = "empty-seat";
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

        localLeft = JSON.parse(JSON.stringify(data.leftBlock));
        localMiddle = JSON.parse(JSON.stringify(data.middleBlock));
        localRight = JSON.parse(JSON.stringify(data.rightBlock));

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

    });


});
//Another Function
function openProfile(student) {

    const popup = document.getElementById("profilePopup");

    popup.innerHTML = `
                    <div class="popup-content">
             <img src="${student.img}" class="student-avatar">

            <h2>${student.fullName}</h2>

            <p><strong>Ngày sinh:</strong> ${student.dob}</p>

            ${student.role ? `<p><strong>Chức vụ:</strong> ${student.role}</p>` : ""}
        <button class="close-popup">Đóng</button>
            </div>
`;


    popup.style.display = "flex";
    popup.querySelector(".close-popup").addEventListener("click", function () {
        popup.style.display = "none";
    });
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
}
function saveSeatmap() {

    if (!isTeacher) {
        alert("Only teacher can save");
        return;
    }

    set(ref(db, "seatmap"), {
        leftBlock: localLeft,
        middleBlock: localMiddle,
        rightBlock: localRight
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