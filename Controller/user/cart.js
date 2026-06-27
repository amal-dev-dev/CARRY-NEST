import Product from "../../Model/productModel.js";
import Cart from "../../Model/cartModel.js";

const addToCart = async(req,res)=>{

    try{

        const userId = req.session.user;
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if( !product || product.isBlocked ) {

            return res.json({
                success:false,
                message:"Product unavailable"
            });

        }

        const stock = product.variants[0]?.stock || 0;

        if(stock <= 0){
            return res.send("Product is out of stock");
        }

        let cart = await Cart.findOne({ userId });

        if(!cart){

            cart = new Cart({

                userId,

                items:[{
                    productId,
                    quantity:1
                }]

            });

        }else{

            const item = cart.items.find(item =>
                item.productId.toString()
                === productId
            );

            if(item){

                item.quantity += 1;

            }else{

                cart.items.push({
                    productId,
                    quantity:1
                });

            }

        }

        await cart.save();

        res.redirect("/user/cart");

    }catch(error){

        console.log(error);

    }

};

const loadCart = async(req,res)=>{

    const cart = await Cart.findOne({
        userId:req.session.user
    }).populate("items.productId");

    if(!cart){

        return res.render("user/cart",{
            cart:{
                items:[]
            },
            subtotal:0,
            discount:0,
            deliveryFee:0,
            grandTotal:0
        });

    }


    const validItems = cart.items.filter(
        item => item.productId
    );

    const subtotal = validItems.reduce(
        (sum, item) =>
            sum +
            item.productId.variants[0].salePrice * item.quantity,
        0
    );

    const discount = 0;

    const deliveryFee = 15;

    const grandTotal = subtotal - discount + deliveryFee;

    const message = req.session.message;
    req.session.message = null;

    res.render("user/cart",{
        cart,
        subtotal,
        discount,
        deliveryFee,
        grandTotal,
        message
    });

};

const increaseQuantity = async(req,res)=>{

    try{

        const userId = req.session.user;

        const productId = req.params.id;

        const cart = await Cart.findOne({
            userId
        });

        const item = cart.items.find(
            item => item.productId.toString() === productId
        );

        const product = await Product.findById(productId);

        if(!item){

            return res.redirect("/user/cart");

        }

        // Maximum Limit

        const stock = product.variants[0]?.stock || 0;

        if(item.quantity >= stock){

            req.session.message = "Stock limit reached";

            return res.redirect("/user/cart");

        }

        // Stock Validation

        if(item.quantity >= product.stock){

            return res.send(
                "Stock limit reached"
            );

        }

        item.quantity++;

        await cart.save();

        res.redirect("/user/cart");

    }catch(error){

        console.log(
            "INCREASE ERROR:",
            error
        );

    }

};

const decreaseQuantity = async(req,res)=>{

    try{

        const userId = req.session.user;

        const productId = req.params.id;

        const cart = await Cart.findOne({
            userId
        });

        const item = cart.items.find(
            item =>
            item.productId.toString() === productId
        );

        if(!item){

            return res.redirect("/user/cart");

        }

        // Remove item if quantity = 1

        if(item.quantity === 1){

            cart.items = cart.items.filter(
                item =>
                item.productId.toString()
                !== productId
            );

        }else{

            item.quantity--;

        }

        await cart.save();

        res.redirect("/user/cart");

    }catch(error){

        console.log(
            "DECREASE ERROR:",
            error
        );

    }

};

const removeCartItem = async(req,res)=>{

    try{

        const userId = req.session.user;

        const productId = req.params.id;

        const cart = await Cart.findOne({
            userId
        });

        if(!cart){

            return res.redirect("/user/cart");

        }

        cart.items = cart.items.filter(
            item =>
            item.productId.toString()
            !== productId
        );

        await cart.save();

        res.redirect("/user/cart");

    }catch(error){

        console.log(
            "REMOVE CART ERROR:",
            error
        );

    }

};

export default {
    addToCart,
    loadCart,
    increaseQuantity,
    decreaseQuantity,
    removeCartItem
}

