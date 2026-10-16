(() => {
    const ticker = document.getElementById("appointmentTicker");
    if (!ticker) return;
    // Add or edit notifications here.
    const appointments = [
        {
            decisionDate: "28/10",
            studentId: "dangkhoi",
            role: "Lớp trưởng"
        }
    ];
    const messages = appointments.map(item => {
        const student = students[item.studentId];

        if (!student) {
            return `Không tìm thấy học sinh: ${item.studentId}`;
        }

        const [day, month] = item.decisionDate.split("/");
        const decisionNumber = `${day}${month}`;
        const studentName = student.fullName;

        return `Theo quyết định của ${decisionNumber} của A5-K68,Học sinh ${studentName}, được bổ nhiệm chức vụ ${item.role}. Chúc ${studentName} nhiệm kỳ mới tốt đẹp!`;
});

ticker.textContent = messages.join(" ★ ")

})