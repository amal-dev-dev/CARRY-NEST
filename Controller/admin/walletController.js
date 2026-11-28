
import walletService from "../../Service/admin/walletService.js";

const loadWallet = async (req, res) => {
    try {
        const search = req.query.search?.trim() || "";
        const page = parseInt(req.query.page, 10) || 1;

        const walletData = await walletService.getWalletData({
            search,
            page,
            limit: 10
        });

        return res.render("admin/wallet", walletData);

    } catch (error) {
        console.error("Admin wallet error:", error);

        return res.status(500).send("Something went wrong");
    }
};

export {
    loadWallet
};
