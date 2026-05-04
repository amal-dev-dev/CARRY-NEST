const inputs = document.querySelectorAll(".otp-inputs input");
const otpValue = document.getElementById("otpValue");
const form = document.getElementById("otpForm");

// Move cursor automatically
inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
        if (input.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    // Handle backspace
    input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

// Combine OTP on submit
form.addEventListener("submit", () => {
    let otp = "";
    inputs.forEach(input => {
        otp += input.value;
    });

    otpValue.value = otp;

    console.log("Final OTP:", otp); // 🔍 debug
});