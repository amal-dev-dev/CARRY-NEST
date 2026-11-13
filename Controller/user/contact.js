const loadContact = (req, res) => {
    try {
        res.render("user/contact");
    } catch (error) {
        console.error("Contact page error:", error);
        res.status(500).send("Something went wrong");
    }
};

const loadAbout = (req, res) => {
    res.render("user/about");
};


export {
    loadContact,
    loadAbout
};