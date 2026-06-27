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

        const variants = req.body.sizes.map((size, index) => ({
            size,
            stock: Number(req.body.stocks[index]),
            regularPrice: Number(req.body.regularPrices[index]),
            salePrice: Number(req.body.salePrices[index])

        }));

        const categories = await Category.find({ isListed: true });

        if(!req.body.productName?.trim()){

            return res.render("admin/add-product",{
                categories,
                message:"Product name is required"
            });

        }

        if(!req.body.description?.trim()){

            return res.render("admin/add-product",{
                categories,
                message:"Description is required"
            });

        }

        if(!req.body.colors?.[0]?.trim()){

            return res.render("admin/add-product",{
                categories,
                message:"At least one color is required"
            });

        }

        for(const variant of variants){

            if(variant.stock < 0){

                return res.render("admin/add-product",{
                    categories,
                    message:"Stock cannot be negative"
                });

            }

        }

        for(const variant of variants){

            if(variant.salePrice > variant.regularPrice){

                return res.render("admin/add-product",{
                    categories,
                    message:"Sale price cannot be greater than original price"
                });

            }

        }


        const newProduct = new Product({

            colors:req.body.colors,

            productName:req.body.productName,

            brand:req.body.brand,

            category:req.body.category,

            description:req.body.description,

            variants,

            offer:req.body.offer,

            productImage:images

        });

        await newProduct.save()

        res.redirect("/admin/products",{
            categories,
            message:"Product save successfully"
        });

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

        const product = await Product.findById(id);

        const categories = await Category.find({
            isListed: true
        });

        const {

            productName,
            offer,
            description,
            category,
            brand,
            colors,
            removedImages

        } = req.body;

        let variants = req.body.size.map((size, index) => ({
            size,
            stock: Number(req.body.stock[index]),
            regularPrice: Number(req.body.regularPrice[index]),
            salePrice: Number(req.body.salePrice[index])
        }));

        // Remove empty rows
        variants = variants.filter(v =>
            v.stock !== 0 ||
            v.regularPrice !== 0 ||
            v.salePrice !== 0
        );

        
    for (const variant of variants) {

    if (variant.stock < 0) {

        const categories = await Category.find({ isListed: true });

        return res.render("admin/edit-product", {
            product,
            categories,
            message: "Stock cannot be less than 0."
        });

    }

    if (variant.regularPrice <= variant.salePrice) {

            const categories = await Category.find({ isListed: true });

            return res.render("admin/edit-product", {
                product,
                categories,
                message: "Regular price must be greater than sale price."
            });

        }

    }

        // Existing images
        let updatedImages = [...product.productImage];

        // Remove selected images
        if (removedImages) {

            const removedIndexes = removedImages.split(",");

            updatedImages = updatedImages.filter(
                (_, index) =>
                !removedIndexes.includes(
                    index.toString()
                )
            );

        }

        // Add new uploaded images
        if (req.files && req.files.length > 0) {

            const newImages = req.files.map(file => file.path);

            updatedImages.push(...newImages);

        }

        await Product.findByIdAndUpdate(id, {

            productName,
            offer,
            description,
            category,
            brand,
            variants,
            colors,
            productImage: updatedImages

        });
        

        res.redirect("/admin/products");

    } catch (error) {

        console.log(
            "EDIT PRODUCT ERROR:",
            error
        );

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