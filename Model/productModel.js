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

    offer:{
        type:String
    },

    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Category"
    },

    description:{
        type:String
    },

    colors:{
        type:[String],
        default:[]
    },

    variants:[
        {
            size:{
                type:String
            },

            stock:{
                type:Number,
                default:0
            },

            regularPrice:{
                type:Number
            },

            salePrice:{
                type:Number
            },

        }
    ],

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