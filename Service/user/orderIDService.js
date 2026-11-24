import crypto from "node:crypto";

const generateOrderId = () => {
    const date = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

    const uniqueCode = crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();

    return `CN-${date}-${uniqueCode}`;
};

export default  generateOrderId ;