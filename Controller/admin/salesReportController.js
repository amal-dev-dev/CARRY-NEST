import salesReportService from "../../Service/admin/salesReportService.js";

const loadSalesReport = async (req, res) => {
    try {
        const reportData =
            await salesReportService.getSalesReportData({
                ...req.query,
                page: req.query.page
            });

        return res.render("admin/sales-report", {
            ...reportData,
            startDate: req.query.startDate || "",
            endDate: req.query.endDate || ""
        });

    } catch (error) {
        console.error("Sales report error:", error);

        if (error.statusCode === 400) {
            return res.status(400).send(error.message);
        }

        return res.status(500).send(
            "Failed to load sales report"
        );
    }
};

export default loadSalesReport;