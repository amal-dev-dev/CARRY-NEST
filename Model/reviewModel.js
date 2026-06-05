import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({

    userId:{

        type:mongoose.Schema.Types.ObjectId,

        ref:"User",

        required:true

    },

    variantId:{

        type:mongoose.Schema.Types.ObjectId,

        ref:"Product",  

        required:true

    },

    rating:{

        type:Number,

        required:true,

        min:1,

        max:5

    },

    comment:{

        type:String,

        trim:true,

        default:""

    },

    image:{

        type:[String],

        default:[]

    },

    createdAt:{

        type:Date,

        default:Date.now

    }

});

const Review = mongoose.model(
    "Review",
    reviewSchema
);

export default Review;