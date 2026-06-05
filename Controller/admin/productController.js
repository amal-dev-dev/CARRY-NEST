import Product from "../../Model/productModel.js";
import Category from "../../Model/categoryModel.js";

const loadProducts = async (req ,res) => {

    try {

        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const totalProductsCount = await Product.countDocuments();

        const searchQuery = {

            productName:{
                $regex:search,
                $options:"i"
            }

        };

        const products = await Product.find(searchQuery)
        .populate("category")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalProducts = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalProducts / limit);
        const lowStockCount = await Product.countDocuments({
            stock: { $gt: 0, $lt: 10 }
        });
        const outOfStockCount = await Product.countDocuments({
            stock: 0
        });

        res.render("admin/products",{

            products,
            currentPage:page,
            totalPages,
            search,
            totalProductsCount,
            lowStockCount,
            outOfStockCount

        });
        
    } catch(error) {
        console.log("PRODUCT PAGE ERROR:",error);
        res.redirect("/admin/pageerror");
    }

};

const loadAddProduct = async(req,res)=>{

    try{

        const categories = await Category.find({

            isListed:true

        });

        res.render("admin/add-product",{

            categories

        });

    }catch(error){

        console.log("LOAD ADD PRODUCT ERROR:",error);

        res.redirect("/admin/pageerror");

    }

};


const addProduct = async(req,res)=>{

    try{
        
        const images = req.files ? req.files.map(file => file.path) : [];


        const newProduct = new Product({

            color:req.body.color,

            productName:req.body.productName,

            brand:req.body.brand,

            category:req.body.category,

            description:req.body.description,

            regularPrice:req.body.regularPrice,

            salePrice:req.body.salePrice,

            stock:req.body.stock,

            productImage:images

        })

        await newProduct.save()

        res.redirect("/admin/products")

    }catch(error){

        console.log("ADD PRODUCT ERROR:", error);
        res.redirect("/admin/add-product");

    }

}


const loadEditProduct = async(req,res)=>{

    try{

        const id = req.params.id;

        const product = await Product.findById(id);

        const categories = await Category.find({

            isListed:true

        });

        res.render("admin/edit-product",{

            product,
            categories

        });

    }catch(error){

        console.log("LOAD EDIT PRODUCT ERROR:",error);

        res.redirect("/admin/pageerror");

    }

};



const editProduct = async (req, res) => {

    try {

        const id = req.params.id;

        const {
            productName,
            description,
            category,
            brand,
            regularPrice,
            salePrice,
            stock
        } = req.body;

        const updateData = {
            productName,
            description,
            category,
            brand,
            regularPrice,
            salePrice,
            stock
        };

        if (req.files && req.files.length > 0) {

            updateData.productImage = req.files.map(
                file => file.path
            );

        }

        await Product.findByIdAndUpdate(id, updateData);

        res.redirect("/admin/products");

    } catch (error) {

        console.log("EDIT PRODUCT ERROR:", error);
        res.redirect("/admin/pageerror");

    }

};



const blockProduct = async(req,res)=>{

    try{

        const id = req.params.id;

        const product = await Product.findById(id);

        await Product.findByIdAndUpdate(id,{

            isBlocked: !product.isBlocked

        });

        res.redirect("/admin/products");

    }catch(error){

        console.log("BLOCK PRODUCT ERROR:",error);

        res.redirect("/admin/pageerror");

    }

};

const unblockProduct = async (req,res)=>{

    try{

        await Product.findByIdAndUpdate(
            req.params.id,
            { isBlocked:false }
        );

        res.redirect("/admin/products");

    }catch(error){

        console.log(error);

        res.redirect("/admin/pageerror");

    }

};



export default {

    loadProducts,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    editProduct,
    blockProduct,
    unblockProduct

};