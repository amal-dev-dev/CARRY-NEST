
import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    offerType: {
      type: String,
      enum: ["product", "category"],
      required: true
    },

    discountType: {
      type: String,
      enum: ["percentage"],
      default: "percentage"
    },

    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 90
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },

    validFrom: {
      type: Date,
      required: true
    },

    validTo: {
      type: Date,
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    bannerImage: {
        type: String,
        default: ""
    },

    showOnHomepage: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

offerSchema.pre("validate", function () {
  if (this.offerType === "product") {
    if (!this.productId) {
      this.invalidate("productId", "Please select a product.");
    }

    this.categoryId = null;
  }

  if (this.offerType === "category") {
    if (!this.categoryId) {
      this.invalidate("categoryId", "Please select a category.");
    }

    this.productId = null;
  }

  if (
    this.validFrom &&
    this.validTo &&
    this.validTo <= this.validFrom
  ) {
    this.invalidate(
      "validTo",
      "End date must be after start date."
    );
  }
});

export default mongoose.model("Offer", offerSchema);