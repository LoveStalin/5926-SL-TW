(function () {
    const ticker = document.getElementById("birthdayTicker");
    if (!ticker || typeof students !== "object") return;

    const monthNames = [
        "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
        "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
        "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ];

    const currentMonth = new Date().getMonth() + 1;

    const birthdays = Object.values(students)
        .filter(student => {
            if (!student?.dob || student.dob.includes("**")) return false;
            const parts = student.dob.split("/");
            return Number(parts[1]) === currentMonth;
        })
        .sort((a, b) => {
            const dayA = Number(a.dob.split("/")[0]);
            const dayB = Number(b.dob.split("/")[0]);
            return dayA - dayB;
        });

    const birthdayText = birthdays.map(student => {
        const [day, month] = student.dob.split("/");
        return `${student.displayName} (${day}/${month})`;
    });

    let message = "";
    if (birthdayText.length === 1) {
        message = `${monthNames[currentMonth - 1]} là sinh nhật của ${birthdayText[0]}.`;
    } else if (birthdayText.length === 2) {
        message = `${monthNames[currentMonth - 1]} là sinh nhật của ${birthdayText[0]} và ${birthdayText[1]}.`;
    } else if (birthdayText.length > 2) {
        const last = birthdayText.pop();
        message = `${monthNames[currentMonth - 1]} là sinh nhật của ${birthdayText.join(", ")} và ${last}.`;
    } else {
        message = `${monthNames[currentMonth - 1]} không có sinh nhật được ghi nhận.`;
    }

    ticker.textContent = message;
})();