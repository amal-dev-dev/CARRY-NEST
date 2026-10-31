import Order from "../../Model/orderModel.js";
import XLSX from "xlsx";
import PDFDocument from "pdfkit";

const getSalesData = async (req) => {

    const {
        status,
        payment,
        category,
        product
    } = req.query;

const period = req.query.period || "30";

const endDate = new Date();
const startDate = new Date();


// CUSTOM DATE RANGE
if (
    period === "custom" &&
    req.query.startDate &&
    req.query.endDate
) {

    const customStart =
        new Date(req.query.startDate);

    const customEnd =
        new Date(req.query.endDate);

    // Validate dates
    if (
        !isNaN(customStart.getTime()) &&
        !isNaN(customEnd.getTime())
    ) {

        // Start of selected start date
        customStart.setHours(
            0, 0, 0, 0
        );

        // End of selected end date
        customEnd.setHours(
            23, 59, 59, 999
        );

        startDate.setTime(
            customStart.getTime()
        );

        endDate.setTime(
            customEnd.getTime()
        );
    }

}


// PRESET PERIODS
else {

    const periodNumber =
        Number(period) || 30;

    if (periodNumber === 365) {

        // Start of current year
        startDate.setMonth(0);
        startDate.setDate(1);
        startDate.setHours(
            0, 0, 0, 0
        );

    } else {

        startDate.setDate(
            startDate.getDate() - periodNumber
        );

        startDate.setHours(
            0, 0, 0, 0
        );

    }

}

    const orders = await Order.find({
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    })
        .populate("userId")
        .populate({
            path: "products.productId",
            populate: {
                path: "category"
            }
        })
        .sort({ createdAt: -1 });


    let filteredOrders = orders;


    // STATUS FILTER
    if (status) {

        filteredOrders = filteredOrders.filter((order) => {

            return String(order.orderStatus || "")
                .toLowerCase() === status.toLowerCase();

        });

    }


    // PAYMENT FILTER
    if (payment) {

        filteredOrders = filteredOrders.filter((order) => {

            return String(order.paymentMethod || "")
                .toLowerCase() === payment.toLowerCase();

        });

    }


    // CATEGORY FILTER
    if (category) {

        filteredOrders = filteredOrders.filter((order) => {

            return order.products.some((item) => {

                return String(
                    item.productId?.category?._id || ""
                ) === String(category);

            });

        });

    }


    // PRODUCT FILTER
    if (product) {

        const search =
            product.toLowerCase().trim();

        filteredOrders = filteredOrders.filter((order) => {

            return order.products.some((item) => {

                const productName =
                    item.productId?.productName || "";

                return productName
                    .toLowerCase()
                    .includes(search);

            });

        });

    }


    return filteredOrders;
};


const createExportData = (orders) => {

    const data = [];

    orders.forEach((order) => {

        if (!Array.isArray(order.products)) {
            return;
        }

        order.products.forEach((item) => {

            const product =
                item.productId;

            data.push({

                OrderID:
                    order.orderId || "",

                Date:
                    order.createdAt
                        ? new Date(order.createdAt)
                            .toLocaleDateString("en-IN")
                        : "",

                Customer:
                    order.userId?.name ||
                    order.userId?.fullName ||
                    order.userId?.username ||
                    order.userId?.email ||
                    "Unknown",

                Product:
                    product?.productName ||
                    "Unknown Product",

                Category:
                    product?.category?.name ||
                    "Unknown Category",

                Quantity:
                    Number(item.quantity) || 0,

                Price:
                    Number(item.price) || 0,

                Total:
                    (Number(item.price) || 0) *
                    (Number(item.quantity) || 0),

                Payment:
                    order.paymentMethod || "",

                PaymentStatus:
                    order.paymentStatus || "",

                OrderStatus:
                    order.orderStatus || ""

            });

        });

    });

    return data;
};

const exportCSV = async (req, res) => {
    try {
        const orders = await getSalesData(req);
        const data = createExportData(orders);

        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const reportPeriod = getReportPeriod(req);

        const escapeCSV = (value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`;

        const headers = [
            "OrderID",
            "Date",
            "Customer",
            "Product",
            "Category",
            "Quantity",
            "Price",
            "Total",
            "Payment",
            "PaymentStatus",
            "OrderStatus"
        ];

        const rows = data.map(item =>
            headers.map(header => escapeCSV(item[header])).join(",")
        );

        const csv = [
            escapeCSV("CARRY NEST - Sales Report"),
            escapeCSV("Date of Generation: " + generatedAt),
            escapeCSV("Period of Generation: " + reportPeriod),
            "",
            headers.map(escapeCSV).join(","),
            ...rows
        ].join("\r\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="sales-report.csv"'
        );

        res.send("\uFEFF" + csv);

    } catch (error) {
        console.error("CSV export error:", error);
        res.status(500).send("Failed to export CSV");
    }
};

const exportExcel = async (req, res) => {
    try {
        const orders = await getSalesData(req);
        const data = createExportData(orders);

        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const reportPeriod = getReportPeriod(req);

        const reportRows = [
            ["CARRY NEST - Sales Report"],
            ["Date of Generation", generatedAt],
            ["Period of Generation", reportPeriod],
            [],
            [
                "OrderID",
                "Date",
                "Customer",
                "Product",
                "Category",
                "Quantity",
                "Price",
                "Total",
                "Payment",
                "PaymentStatus",
                "OrderStatus"
            ],
            ...data.map(item => [
                item.OrderID,
                item.Date,
                item.Customer,
                item.Product,
                item.Category,
                item.Quantity,
                item.Price,
                item.Total,
                item.Payment,
                item.PaymentStatus,
                item.OrderStatus
            ])
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(reportRows);

        // Format the report title
        worksheet["A1"].s = {
            font: { bold: true, sz: 16 }
        };

        // Set readable column widths
        worksheet["!cols"] = [
            { wch: 18 },
            { wch: 14 },
            { wch: 24 },
            { wch: 25 },
            { wch: 20 },
            { wch: 12 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 },
            { wch: 18 },
            { wch: 18 }
        ];

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Sales Report"
        );

        const buffer = XLSX.write(workbook, {
            type: "buffer",
            bookType: "xlsx"
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="sales-report.xlsx"'
        );

        res.send(buffer);

    } catch (error) {
        console.error("Excel export error:", error);
        res.status(500).send("Failed to export Excel");
    }
};

const getReportPeriod = (req) => {
    const period = req.query.period || "30";

    if (
        period === "custom" &&
        req.query.startDate &&
        req.query.endDate
    ) {
        return `${req.query.startDate} to ${req.query.endDate}`;
    }

    const periodLabels = {
        "7": "Last 7 Days",
        "30": "Last 30 Days",
        "90": "Last 90 Days",
        "365": "Current Year"
    };

    return periodLabels[period] || "Last 30 Days";
};


const exportPDF = async (req, res) => {
    try {
        const orders = await getSalesData(req);
        const data = createExportData(orders);

        const doc = new PDFDocument({
            margin: 25,
            size: "A4",
            layout: "landscape",
            bufferPages: false
        });

        res.setHeader("Content-Type", "application/pdf");

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="sales-report.pdf"'
        );

        doc.pipe(res);

        const pageWidth = doc.page.width;
        const margin = 25;
        const tableWidth = pageWidth - margin * 2;

        // Table columns
        const columns = [
            { key: "OrderID", label: "Order ID", width: 75 },
            { key: "Date", label: "Date", width: 65 },
            { key: "Customer", label: "Customer", width: 105 },
            { key: "Product", label: "Product", width: 165 },
            { key: "Quantity", label: "Qty", width: 40 },
            { key: "Price", label: "Price (Rs.)", width: 75 },
            { key: "Total", label: "Total (Rs.)", width: 75 },
            { key: "Payment", label: "Payment", width: 90 },
            { key: "OrderStatus", label: "Status", width: 102 }
        ];

        // Ensure the table fits the printable page width
        const widthSum = columns.reduce(
            (sum, column) => sum + column.width,
            0
        );

        if (widthSum !== tableWidth) {
            const scale = tableWidth / widthSum;

            columns.forEach(column => {
                column.width *= scale;
            });
        }

        const headerHeight = 28;
        const cellPadding = 5;
        const bottomMargin = 25;

        // Draw the table header
        const drawTableHeader = () => {
            const y = doc.y;

            let x = margin;

            columns.forEach(column => {
                doc
                    .rect(x, y, column.width, headerHeight)
                    .fillAndStroke("#1f2937", "#d1d5db");

                doc
                    .fillColor("#ffffff")
                    .font("Helvetica-Bold")
                    .fontSize(8)
                    .text(
                        column.label,
                        x + cellPadding,
                        y + 8,
                        {
                            width: column.width - cellPadding * 2,
                            height: headerHeight - 10,
                            align: "left",
                            lineBreak: false
                        }
                    );

                x += column.width;
            });

            doc.fillColor("#111827");
            doc.y = y + headerHeight;
        };


        // Report title
        doc
            .fillColor("#111827")
            .font("Helvetica-Bold")
            .fontSize(20)
            .text("CARRY NEST - Sales Report", {
                align: "center"
            });

        doc.moveDown(0.5);

        // Date and time when the report was generated
        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        // Selected reporting period
        const reportPeriod = getReportPeriod(req);

        doc
            .fillColor("#374151")
            .font("Helvetica")
            .fontSize(10)
            .text(`Date of Generation: ${generatedAt}`, margin);

        doc.moveDown(0.3);

        doc
            .font("Helvetica")
            .fontSize(10)
            .text(`Period of Generation: ${reportPeriod}`, margin);

        doc.moveDown(0.5);

        doc
            .font("Helvetica")
            .fontSize(9)
            .text(`Total product rows: ${data.length}`, margin);

        doc.moveDown(1);

        doc
            .font("Helvetica")
            .fontSize(9)
            .text(`Total product rows: ${data.length}`, margin);

        doc.moveDown(1);

        drawTableHeader();

        // Table body
        if (data.length === 0) {
            doc
                .font("Helvetica")
                .fontSize(10)
                .text(
                    "No sales records found for the selected filters.",
                    margin,
                    doc.y + 12
                );
        } else {
            data.forEach((item, index) => {
                // Prepare cell values
                const values = columns.map(column => {
                    const value = item[column.key] ?? "";

                    if (
                        column.key === "Price" ||
                        column.key === "Total"
                    ) {
                        return Number(value).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }

                    return String(value);
                });

                // Calculate row height based on wrapped text
                doc.font("Helvetica").fontSize(7);

                const rowHeight = Math.max(
                    28,
                    ...values.map((value, i) => {
                        return doc.heightOfString(value, {
                            width: columns[i].width - cellPadding * 2,
                            font: "Helvetica",
                            fontSize: 7,
                            lineGap: 1
                        }) + cellPadding * 2;
                    })
                );

                // Add a page and repeat the table header
                if (
                    doc.y + rowHeight >
                    doc.page.height - bottomMargin
                ) {
                    doc.addPage();

                    doc
                        .font("Helvetica-Bold")
                        .fontSize(12)
                        .fillColor("#111827")
                        .text("CARRY NEST - Sales Report", margin, 20);

                    doc.y = 45;

                    drawTableHeader();
                }

                const y = doc.y;
                let x = margin;

                columns.forEach((column, i) => {
                    // Alternate row background colors
                    const background =
                        index % 2 === 0 ? "#ffffff" : "#f3f4f6";

                    doc
                        .rect(x, y, column.width, rowHeight)
                        .fillAndStroke(background, "#d1d5db");

                    doc
                        .fillColor("#111827")
                        .font("Helvetica")
                        .fontSize(7)
                        .text(
                            values[i],
                            x + cellPadding,
                            y + cellPadding,
                            {
                                width: column.width - cellPadding * 2,
                                height: rowHeight - cellPadding * 2,
                                lineGap: 1
                            }
                        );

                    x += column.width;
                });

                doc.y = y + rowHeight;
            });
        }

        doc.end();
    } catch (error) {
        console.error("PDF export error:", error);

        if (!res.headersSent) {
            res.status(500).send("Failed to export PDF");
        } else {
            res.destroy(error);
        }
    }
};


export {
    exportCSV,
    exportExcel,
    exportPDF
};

