const validateAddress = (data) => {
    const errors = {};

    const {
        fullName,
        mobile,
        address,
        city,
        state,
        pincode,
        houseName,
        landmark
    } = data;

    // Full name
    if (!fullName?.trim()) {
        errors.fullName = "Full name is required";
    } else if (!/^[A-Za-z\s]+$/.test(fullName.trim())) {
        errors.fullName = "Full name should contain only letters";
    } else if (fullName.trim().length < 3) {
        errors.fullName = "Full name must be at least 3 characters";
    }

    // Mobile
    if (!mobile?.trim()) {
        errors.mobile = "Mobile number is required";
    } else if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
        errors.mobile = "Enter a valid 10-digit mobile number";
    }

    // Address
    if (!address?.trim()) {
        errors.address = "Address is required";
    } else if (address.trim().length < 5) {
        errors.address = "Address must be at least 5 characters";
    } else if (!/[A-Za-z]/.test(address.trim())) {
        errors.address = "Address must contain at least some letters";
    }

    // City
    if (!city?.trim()) {
        errors.city = "City is required";
    } else if (!/^[A-Za-z\s]+$/.test(city.trim())) {
        errors.city = "City should contain only letters";
    }

    // State
    if (!state?.trim()) {
        errors.state = "State is required";
    } else if (!/^[A-Za-z\s]+$/.test(state.trim())) {
        errors.state = "State should contain only letters";
    }

    // Pincode
    if (!pincode?.trim()) {
        errors.pincode = "Pincode is required";
    } else if (!/^\d{6}$/.test(pincode.trim())) {
        errors.pincode = "Pincode must be exactly 6 digits";
    }

    // House / Building
    if (houseName && houseName.trim().length > 100) {
        errors.houseName = "House / Building name must not exceed 100 characters";
    }

    // Landmark
    if (landmark && landmark.trim().length > 100) {
        errors.landmark = "Landmark is too long";
    }

    return errors;
};

export default {
    validateAddress
};  