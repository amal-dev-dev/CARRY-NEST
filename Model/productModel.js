import mongoose from "mongoose";

const productSchema = new mongoose.Schema({

    productName:{
        type:String,
        required:true
    },

    brand:{
        type:String,
        required:true
    },

    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Category"
    },

    description:{
        type:String
    },

    regularPrice:{
        type:Number
    },

    salePrice:{
        type:Number
    },

    stock:{
        type:Number,
        default: 0 
    },

    color:{
        type:String
    },

    productImage:{
        type:[String],
        default:[]
    },

    isBlocked:{
        type:Boolean,
        default:false
    },

    createdAt:{
        type:Date,
        default:Date.now
    }

});

const Product = mongoose.model("Product",productSchema);

export default Product;