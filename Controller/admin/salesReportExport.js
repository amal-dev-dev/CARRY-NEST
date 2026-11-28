
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import salesReportExportService from "../../Service/admin/salesReportExportService.js";


// =========================================
// CSV EXPORT
// =========================================
const exportCSV = async (req, res) => {
    try {
        const orders =
            await salesReportExportService.getSalesData(req);

        const data =
            salesReportExportService.createExportData(orders);

        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const reportPeriod =
            salesReportExportService.getReportPeriod(req);

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

        const rows = data.map((item) =>
            headers
                .map((header) => escapeCSV(item[header]))
                .join(",")
        );

        const csv = [
            escapeCSV("CARRY NEST - Sales Report"),
            escapeCSV("Date of Generation: " + generatedAt),
            escapeCSV("Period of Generation: " + reportPeriod),
            "",
            headers.map(escapeCSV).join(","),
            ...rows
        ].join("\r\n");

        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="sales-report.csv"'
        );

        return res.send("\uFEFF" + csv);

    } catch (error) {
        console.error("CSV export error:", error);

        return res.status(500).send(
            "Failed to export CSV"
        );
    }
};


// =========================================
// EXCEL EXPORT
// =========================================
const exportExcel = async (req, res) => {
    try {
        const orders =
            await salesReportExportService.getSalesData(req);

        const data =
            salesReportExportService.createExportData(orders);

        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const reportPeriod =
            salesReportExportService.getReportPeriod(req);

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

        const reportRows = [
            ["CARRY NEST - Sales Report"],
            ["Date of Generation", generatedAt],
            ["Period of Generation", reportPeriod],
            [],
            headers,
            ...data.map((item) =>
                headers.map((header) => item[header])
            )
        ];

        // Create workbook
        const workbook = new ExcelJS.Workbook();

        workbook.creator = "CARRY NEST";
        workbook.created = new Date();

        // Create worksheet
        const worksheet =
            workbook.addWorksheet("Sales Report");

        worksheet.addRows(reportRows);

        // =========================================
        // TITLE FORMAT
        // =========================================
        worksheet.getCell("A1").font = {
            bold: true,
            size: 16
        };

        worksheet.mergeCells("A1:K1");

        // =========================================
        // HEADER FORMAT
        // =========================================
        const headerRow = worksheet.getRow(5);

        headerRow.font = {
            bold: true
        };

        headerRow.alignment = {
            vertical: "middle",
            horizontal: "center"
        };

        headerRow.height = 25;

        // =========================================
        // COLUMN WIDTHS
        // =========================================
        worksheet.columns = [
            { width: 18 },
            { width: 14 },
            { width: 24 },
            { width: 25 },
            { width: 20 },
            { width: 12 },
            { width: 14 },
            { width: 14 },
            { width: 16 },
            { width: 18 },
            { width: 18 }
        ];

        // =========================================
        // NUMERIC FORMATTING
        // =========================================
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber >= 6) {
                row.getCell(6).numFmt = "0";
                row.getCell(7).numFmt = "#,##0.00";
                row.getCell(8).numFmt = "#,##0.00";
            }
        });

        // =========================================
        // GENERATE BUFFER
        // =========================================
        const buffer =
            await workbook.xlsx.writeBuffer();

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="sales-report.xlsx"'
        );

        return res.send(Buffer.from(buffer));

    } catch (error) {
        console.error("Excel export error:", error);

        return res.status(500).send(
            "Failed to export Excel"
        );
    }
};


// =========================================
// PDF EXPORT
// =========================================
const exportPDF = async (req, res) => {
    try {
        const orders =
            await salesReportExportService.getSalesData(req);

        const data =
            salesReportExportService.createExportData(orders);

        const reportPeriod =
            salesReportExportService.getReportPeriod(req);

        const generatedAt = new Date().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const doc = new PDFDocument({
            margin: 25,
            size: "A4",
            layout: "landscape"
        });

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="sales-report.pdf"'
        );

        doc.pipe(res);

        const margin = 25;
        const tableWidth = doc.page.width - margin * 2;

        // =========================================
        // TABLE COLUMNS
        // =========================================
        const columns = [
            { key: "OrderID", label: "Order ID", width: 65 },
            { key: "Date", label: "Date", width: 58 },
            { key: "Customer", label: "Customer", width: 90 },
            { key: "Product", label: "Product", width: 125 },
            { key: "Category", label: "Category", width: 75 },
            { key: "Quantity", label: "Qty", width: 35 },
            { key: "Price", label: "Price", width: 60 },
            { key: "Total", label: "Total", width: 60 },
            { key: "Payment", label: "Payment", width: 65 },
            { key: "PaymentStatus", label: "Pay Status", width: 65 },
            { key: "OrderStatus", label: "Status", width: 65 }
        ];

        // Adjust column widths to fit page
        const widthSum = columns.reduce(
            (sum, column) => sum + column.width,
            0
        );

        const scale = tableWidth / widthSum;

        columns.forEach((column) => {
            column.width *= scale;
        });

        const headerHeight = 27;
        const cellPadding = 4;
        const bottomMargin = 25;

        // =========================================
        // DRAW TABLE HEADER
        // =========================================
        const drawTableHeader = () => {
            const y = doc.y;
            let x = margin;

            columns.forEach((column) => {
                doc
                    .rect(
                        x,
                        y,
                        column.width,
                        headerHeight
                    )
                    .fillAndStroke("#1f2937", "#d1d5db");

                doc
                    .fillColor("#ffffff")
                    .font("Helvetica-Bold")
                    .fontSize(7)
                    .text(
                        column.label,
                        x + cellPadding,
                        y + 8,
                        {
                            width: column.width - cellPadding * 2,
                            height: headerHeight - 10,
                            lineBreak: false
                        }
                    );

                x += column.width;
            });

            doc.fillColor("#111827");
            doc.y = y + headerHeight;
        };

        // =========================================
        // REPORT TITLE
        // =========================================
        doc
            .fillColor("#111827")
            .font("Helvetica-Bold")
            .fontSize(20)
            .text(
                "CARRY NEST - Sales Report",
                {
                    align: "center"
                }
            );

        doc.moveDown(0.5);

        doc
            .fillColor("#374151")
            .font("Helvetica")
            .fontSize(10)
            .text(
                `Date of Generation: ${generatedAt}`,
                margin
            );

        doc.moveDown(0.3);

        doc
            .font("Helvetica")
            .fontSize(10)
            .text(
                `Period of Generation: ${reportPeriod}`,
                margin
            );

        doc.moveDown(0.3);

        doc
            .font("Helvetica")
            .fontSize(9)
            .text(
                `Total product rows: ${data.length}`,
                margin
            );

        doc.moveDown(0.8);

        drawTableHeader();

        // =========================================
        // EMPTY REPORT
        // =========================================
        if (data.length === 0) {
            doc
                .font("Helvetica")
                .fontSize(10)
                .text(
                    "No sales records found for the selected filters.",
                    margin,
                    doc.y + 12
                );
        }

        // =========================================
        // TABLE BODY
        // =========================================
        data.forEach((item, index) => {
            const values = columns.map((column) => {
                const value = item[column.key] ?? "";

                if (
                    column.key === "Price" ||
                    column.key === "Total"
                ) {
                    return Number(value).toLocaleString(
                        "en-IN",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }
                    );
                }

                return String(value);
            });

            // Calculate row height
            doc.font("Helvetica").fontSize(7);

            const rowHeight = Math.max(
                25,
                ...values.map((value, i) =>
                    doc.heightOfString(value, {
                        width:
                            columns[i].width -
                            cellPadding * 2,
                        font: "Helvetica",
                        fontSize: 7,
                        lineGap: 1
                    }) + cellPadding * 2
                )
            );

            // =========================================
            // NEW PAGE WHEN NEEDED
            // =========================================
            if (
                doc.y + rowHeight >
                doc.page.height - bottomMargin
            ) {
                doc.addPage();

                doc
                    .font("Helvetica-Bold")
                    .fontSize(12)
                    .fillColor("#111827")
                    .text(
                        "CARRY NEST - Sales Report",
                        margin,
                        20
                    );

                doc.y = 45;

                drawTableHeader();
            }

            const y = doc.y;
            let x = margin;

            // =========================================
            // DRAW ROW CELLS
            // =========================================
            columns.forEach((column, i) => {
                const background =
                    index % 2 === 0
                        ? "#ffffff"
                        : "#f3f4f6";

                doc
                    .rect(
                        x,
                        y,
                        column.width,
                        rowHeight
                    )
                    .fillAndStroke(
                        background,
                        "#d1d5db"
                    );

                doc
                    .fillColor("#111827")
                    .font("Helvetica")
                    .fontSize(7)
                    .text(
                        values[i],
                        x + cellPadding,
                        y + cellPadding,
                        {
                            width:
                                column.width -
                                cellPadding * 2,
                            height:
                                rowHeight -
                                cellPadding * 2,
                            lineGap: 1
                        }
                    );

                x += column.width;
            });

            doc.y = y + rowHeight;
        });

        doc.end();

    } catch (error) {
        console.error("PDF export error:", error);

        if (!res.headersSent) {
            return res.status(500).send(
                "Failed to export PDF"
            );
        }

        res.destroy(error);
    }
};


// =========================================
// EXPORT CONTROLLER METHODS
// =========================================
export {
    exportCSV,
    exportExcel,
    exportPDF
};
