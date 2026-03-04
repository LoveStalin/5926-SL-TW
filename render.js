import { db, ref, set, onValue } from "./firebase.js";
console.log("render is running");

document.addEventListener("DOMContentLoaded", () => {

    const container = document.getElementById("seatmap");

    if (!container) {
        console.error("Không tìm thấy container seatmap");
        return;
    }

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

        leftBlock = data.leftBlock;
        middleBlock = data.middleBlock;
        rightBlock = data.rightBlock;

        container.innerHTML = "";

        const totalRows = Math.max(
            leftBlock.length,
            middleBlock.length,
            rightBlock.length
        );

        for (let i = 0; i < totalRows; i++) {
            renderRow(
                leftBlock[i] || [],
                middleBlock[i] || [],
                rightBlock[i] || []
            );
        }
    });
    window.initSeatmap = function () {
        set(ref(db, "seatmap"), {
            leftBlock,
            middleBlock,
            rightBlock
        });
    }

});
//Another Function
function openProfile(student) {

    const popup = document.getElementById("profilePopup");

    popup.innerHTML = `
                    < div class="popup-content" >
            <h2>${student.fullName}</h2>

            <p><strong>Ngày sinh:</strong> ${student.dob}</p>

            ${student.role ? `<p><strong>Chức vụ:</strong> ${student.role}</p>` : ""}

                <button onclick="closePopup()">Đóng</button>
        </div >
                    `;

    popup.style.display = "flex";
}
function closePopup() {
    document.getElementById("profilePopup").style.display = "none";
}