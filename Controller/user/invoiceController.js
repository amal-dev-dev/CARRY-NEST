
import PDFDocument from "pdfkit";
import Order from "../../Model/orderModel.js";

const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user;

        // ----------------------------------------------------
        // FIND ORDER
        // ----------------------------------------------------

        const order = await Order.findOne({
            _id: orderId,
            userId
        }).populate("products.productId");

        if (!order) {
            return res.status(404).send("Order not found");
        }


        // Separate products based on their latest item status
        const getItemStatus = item =>
            String(item.status || "pending").toLowerCase();

        const cancelledProducts = order.products.filter(
            item => getItemStatus(item) === "cancelled"
        );

        const returnedProducts = order.products.filter(
            item => getItemStatus(item) === "returned"
        );

        const activeProducts = order.products.filter(item =>
            !["cancelled", "returned"].includes(getItemStatus(item))
        );

        // Calculate the original order subtotal
        const originalSubtotal = order.products.reduce(
            (total, item) =>
                total +
                Number(item.price || 0) *
                Number(item.quantity || 0),
            0
        );

        // Calculate subtotal for items not cancelled or returned
        const subtotal = activeProducts.reduce(
            (total, item) =>
                total +
                Number(item.price || 0) *
                Number(item.quantity || 0),
            0
        );

        // Adjust coupon discount proportionally
        const originalDiscount = Number(order.discountApplied || 0);

        let discount = originalDiscount;

        const hasRemovedItems =
            cancelledProducts.length > 0 ||
            returnedProducts.length > 0;

        if (hasRemovedItems && originalSubtotal > 0) {
            discount =
                originalDiscount * (subtotal / originalSubtotal);
        }

        discount = Number(
            Math.min(Math.max(discount, 0), subtotal).toFixed(2)
        );

        // Keep your existing free-delivery rule
        const deliveryCharge = 0;

        const grandTotal = Math.max(
            Number((subtotal - discount + deliveryCharge).toFixed(2)),
            0
        );

        // Determine the status to display on the invoice
        const allItemsRemoved =
            order.products.length > 0 &&
            activeProducts.length === 0;

        let displayStatus = order.orderStatus || "pending";

        if (allItemsRemoved) {
            const allCancelled =
                cancelledProducts.length === order.products.length;

            const allReturned =
                returnedProducts.length === order.products.length;

            if (allCancelled) {
                displayStatus = "cancelled";
            } else if (allReturned) {
                displayStatus = "returned";
            } else {
                displayStatus = "cancelled/returned";
            }
        } else if (cancelledProducts.length > 0 ||
                   returnedProducts.length > 0) {
            if (returnedProducts.length > 0) {
                displayStatus = "partially_returned";
            } else {
                displayStatus = "partially_cancelled";
            }
        }

        const isPaymentFailed =
            order.paymentStatus === "failed" ||
            order.orderStatus === "payment_failed";


        // ----------------------------------------------------
        // PDF RESPONSE HEADERS
        // ----------------------------------------------------

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice-${order.orderId || order._id}.pdf`
        );

        // ----------------------------------------------------
        // CREATE PDF
        // ----------------------------------------------------

        const doc = new PDFDocument({
            size: "A4",
            margin: 45
        });

        doc.pipe(res);

        // ----------------------------------------------------
        // COLORS
        // ----------------------------------------------------

        const dark = "#1f2937";
        const gray = "#6b7280";
        const lightGray = "#f3f4f6";
        const border = "#d1d5db";
        const green = "#15803d";
        const red = "#dc2626";

        // ----------------------------------------------------
        // HEADER
        // ----------------------------------------------------

        doc
            .fontSize(24)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "CARRY NEST",
                45,
                45
            );

        doc
            .fontSize(10)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "Premium Bags & Travel Accessories",
                45,
                75
            );

        doc
            .fontSize(26)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "INVOICE",
                380,
                45,
                {
                    align: "right",
                    width: 165
                }
            );

        // ----------------------------------------------------
        // HEADER LINE
        // ----------------------------------------------------

        doc
            .moveTo(45, 105)
            .lineTo(550, 105)
            .strokeColor(border)
            .stroke();

        // ----------------------------------------------------
        // ORDER INFORMATION
        // ----------------------------------------------------

        doc
            .fontSize(10)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "ORDER ID",
                45,
                125
            );

        doc
            .fontSize(11)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                order.orderId ||
                order._id.toString(),
                45,
                141
            );

        doc
            .fontSize(10)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "INVOICE DATE",
                250,
                125
            );

        doc
            .fontSize(11)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                new Date().toLocaleDateString("en-IN"),
                250,
                141
            );

        doc
            .fontSize(10)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "PAYMENT",
                420,
                125
            );

        doc
            .fontSize(11)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                order.paymentMethod || "COD",
                420,
                141
            );

        // ----------------------------------------------------
        // CUSTOMER DETAILS
        // ----------------------------------------------------

        doc
            .roundedRect(
                45,
                175,
                245,
                105,
                5
            )
            .fillColor(lightGray)
            .fill();

        doc
            .fontSize(11)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "BILL TO",
                60,
                190
            );

        doc
            .fontSize(10)
            .fillColor(dark)
            .font("Helvetica")
            .text(
                order.deliveryAddress?.name || "-",
                60,
                212
            )
            .text(
                order.deliveryAddress?.phone || "-",
                60,
                229
            )
            .text(
                order.deliveryAddress?.addressLine1 || "",
                60,
                246
            )
            .text(
                `${order.deliveryAddress?.city || ""}, ${order.deliveryAddress?.state || ""}`,
                60,
                263
            )
            .text(
                order.deliveryAddress?.pincode || "",
                60,
                280
            );

        // ----------------------------------------------------
        // ORDER STATUS BOX
        // ----------------------------------------------------

        doc
            .roundedRect(
                310,
                175,
                240,
                105,
                5
            )
            .fillColor(lightGray)
            .fill();

        doc
            .fontSize(11)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "ORDER STATUS",
                325,
                190
            );


        const status = isPaymentFailed
            ? "PAYMENT FAILED"
            : displayStatus.replaceAll("_", " ").toUpperCase();

        doc
            .fontSize(12)
            .fillColor(
                isPaymentFailed ||
                status === "CANCELLED"
                    ? red
                    : green
            )
            .font("Helvetica-Bold")
            .text(
                status,
                325,
                215
            );

        doc
            .fontSize(10)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "Payment Method",
                325,
                245
            );

        doc
            .fontSize(10)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                order.paymentMethod === "RAZORPAY"
                    ? "Razorpay"
                    : order.paymentMethod === "WALLET"
                        ? "Wallet"
                        : "Cash On Delivery",
                325,
                261
            );

        // ----------------------------------------------------
        // PAYMENT STATUS
        // ----------------------------------------------------

        doc
            .fontSize(9)
            .fillColor(
                order.paymentStatus === "failed"
                    ? red
                    : order.paymentStatus === "completed"
                        ? green
                        : gray
            )
            .font("Helvetica-Bold")
            .text(
                order.paymentStatus === "failed"
                    ? "Payment Failed"
                    : order.paymentStatus === "completed"
                        ? "Payment Completed"
                        : "Payment Pending",
                325,
                278
            );

        // ----------------------------------------------------
        // PRODUCTS TABLE
        // ----------------------------------------------------

        let tableTop = 315;

        doc
            .fontSize(13)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "ORDER ITEMS",
                45,
                tableTop
            );

        tableTop += 25;

        // ----------------------------------------------------
        // TABLE HEADER
        // ----------------------------------------------------

        doc
            .rect(
                45,
                tableTop,
                505,
                28
            )
            .fillColor(dark)
            .fill();

        doc
            .fontSize(9)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text(
                "PRODUCT",
                55,
                tableTop + 9
            );

        doc
            .text(
                "QTY",
                350,
                tableTop + 9
            );

        doc
            .text(
                "PRICE",
                400,
                tableTop + 9
            );

        doc
            .text(
                "TOTAL",
                475,
                tableTop + 9
            );

        tableTop += 28;

        // ----------------------------------------------------
        // ACTIVE PRODUCT ROWS
        // ----------------------------------------------------

        activeProducts.forEach((item, index) => {

            const name =
                item.productId?.productName ||
                "Product";

            const quantity =
                Number(item.quantity || 1);

            const price =
                Number(item.price || 0);

            const total =
                quantity * price;

            const rowHeight = 35;

            if (index % 2 === 0) {

                doc
                    .rect(
                        45,
                        tableTop,
                        505,
                        rowHeight
                    )
                    .fillColor("#f9fafb")
                    .fill();
            }

            doc
                .fontSize(9)
                .fillColor(dark)
                .font("Helvetica")
                .text(
                    name,
                    55,
                    tableTop + 12,
                    {
                        width: 275
                    }
                );

            doc
                .text(
                    quantity.toString(),
                    350,
                    tableTop + 12
                );

            doc
                .text(
                    `₹${price.toFixed(2)}`,
                    400,
                    tableTop + 12
                );

            doc
                .font("Helvetica-Bold")
                .text(
                    `₹${total.toFixed(2)}`,
                    475,
                    tableTop + 12
                );

            doc
                .moveTo(
                    45,
                    tableTop + rowHeight
                )
                .lineTo(
                    550,
                    tableTop + rowHeight
                )
                .strokeColor(border)
                .stroke();

            tableTop += rowHeight;
        });

        // ----------------------------------------------------
        // NO ACTIVE PRODUCTS
        // ----------------------------------------------------

        if (activeProducts.length === 0) {

            doc
                .fontSize(10)
                .fillColor(gray)
                .font("Helvetica")
                .text(
                    "No active products in this order.",
                    55,
                    tableTop + 12
                );

            tableTop += 35;
        }

        // ----------------------------------------------------
        // CANCELLED PRODUCTS
        // ----------------------------------------------------

        if (cancelledProducts.length > 0) {

            tableTop += 25;

            doc
                .fontSize(11)
                .fillColor(red)
                .font("Helvetica-Bold")
                .text(
                    "CANCELLED ITEMS",
                    45,
                    tableTop
                );

            tableTop += 20;

            cancelledProducts.forEach(item => {

                const name =
                    item.productId?.productName ||
                    "Product";

                const quantity =
                    Number(item.quantity || 1);

                const price =
                    Number(item.price || 0);

                const total =
                    quantity * price;

                doc
                    .fontSize(9)
                    .fillColor(gray)
                    .font("Helvetica")
                    .text(
                        `${name}  •  Qty: ${quantity}  •  ₹${total.toFixed(2)}  •  Cancelled`,
                        55,
                        tableTop
                    );

                tableTop += 20;
            });
        }

        // ----------------------------------------------------
        // Returned products
        // ----------------------------------------------------
        
        if (returnedProducts.length > 0) {
            tableTop += 25;

            doc
                .fontSize(11)
                .fillColor(red)
                .font("Helvetica-Bold")
                .text("RETURNED ITEMS", 45, tableTop);

            tableTop += 20;

            returnedProducts.forEach(item => {
                const name =
                    item.productId?.productName || "Product";

                const quantity = Number(item.quantity || 1);
                const price = Number(item.price || 0);
                const total = quantity * price;

                doc
                    .fontSize(9)
                    .fillColor(gray)
                    .font("Helvetica")
                    .text(
                        `${name}  |  Qty: ${quantity}  |  ₹${total.toFixed(2)}  |  Returned`,
                        55,
                        tableTop,
                        { width: 490 }
                    );

                tableTop += 20;
            });
        }


        // ----------------------------------------------------
        // SUMMARY
        // ----------------------------------------------------

        tableTop += 20;

        const summaryX = 345;
        const valueX = 475;

        doc
            .fontSize(12)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "SUMMARY",
                summaryX,
                tableTop
            );

        tableTop += 25;

        // ----------------------------------------------------
        // SUBTOTAL
        // ----------------------------------------------------

        doc
            .fontSize(10)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "Subtotal",
                summaryX,
                tableTop
            );

        doc
            .fillColor(dark)
            .text(
                `₹${subtotal.toFixed(2)}`,
                valueX,
                tableTop
            );

        tableTop += 20;

        // ----------------------------------------------------
        // COUPON DISCOUNT
        // ----------------------------------------------------

        doc
            .fillColor(gray)
            .text(
                "Coupon Discount",
                summaryX,
                tableTop
            );

        doc
            .fillColor(
                discount > 0
                    ? green
                    : dark
            )
            .text(
                discount > 0
                    ? `- ₹${discount.toFixed(2)}`
                    : "₹0.00",
                valueX,
                tableTop
            );

        tableTop += 20;

        // ----------------------------------------------------
        // DELIVERY
        // ----------------------------------------------------

        doc
            .fillColor(gray)
            .text(
                "Delivery",
                summaryX,
                tableTop
            );

        doc
            .fillColor(dark)
            .text(
                deliveryCharge === 0
                    ? "FREE"
                    : `₹${deliveryCharge.toFixed(2)}`,
                valueX,
                tableTop
            );

        tableTop += 12;

        // ----------------------------------------------------
        // SUMMARY LINE
        // ----------------------------------------------------

        doc
            .moveTo(
                summaryX,
                tableTop
            )
            .lineTo(
                550,
                tableTop
            )
            .strokeColor(border)
            .stroke();

        tableTop += 18;

        // ----------------------------------------------------
        // GRAND TOTAL
        // ----------------------------------------------------

        doc
            .fontSize(13)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "GRAND TOTAL",
                summaryX,
                tableTop
            );

        doc
            .text(
                `₹${grandTotal.toFixed(2)}`,
                valueX,
                tableTop
            );

        // ----------------------------------------------------
        // PAYMENT FAILED NOTE
        // ----------------------------------------------------

        if (isPaymentFailed) {

            tableTop += 35;

            doc
                .fontSize(9)
                .fillColor(red)
                .font("Helvetica-Bold")
                .text(
                    "Payment was not completed for this order.",
                    45,
                    tableTop,
                    {
                        align: "center",
                        width: 505
                    }
                );

            tableTop += 15;

            doc
                .fontSize(8)
                .fillColor(gray)
                .font("Helvetica")
                .text(
                    "This invoice is provided for order reference only.",
                    45,
                    tableTop,
                    {
                        align: "center",
                        width: 505
                    }
                );
        }

        // ----------------------------------------------------
        // FOOTER
        // ----------------------------------------------------

        const footerY = 750;

        doc
            .moveTo(
                45,
                footerY - 20
            )
            .lineTo(
                550,
                footerY - 20
            )
            .strokeColor(border)
            .stroke();

        doc
            .fontSize(10)
            .fillColor(dark)
            .font("Helvetica-Bold")
            .text(
                "Thank you for shopping with Carry Nest!",
                45,
                footerY,
                {
                    align: "center",
                    width: 505
                }
            );

        doc
            .fontSize(8)
            .fillColor(gray)
            .font("Helvetica")
            .text(
                "This is a computer-generated invoice and does not require a signature.",
                45,
                footerY + 18,
                {
                    align: "center",
                    width: 505
                }
            );

        // ----------------------------------------------------
        // END PDF
        // ----------------------------------------------------

        doc.end();

    } catch (error) {

        console.error(
            "DOWNLOAD INVOICE ERROR:",
            error
        );

        if (!res.headersSent) {
            return res
                .status(500)
                .send("Server error");
        }
    }
};

export default {
    downloadInvoice
};

