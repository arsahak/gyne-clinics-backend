import mongoose, { Document, Schema } from "mongoose";

// Order Item Interface
export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  productName: string;
  productImage?: string;
  sku: string;
  variant?: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

// Shipping Address Interface
export interface IShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Payment Info Interface
export interface IPaymentInfo {
  method:
    | "cash_on_delivery"
    | "card"
    | "bank_transfer"
    | "mobile_payment"
    | "paypal"
    | "stripe";
  transactionId?: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paidAt?: Date;
}

// Order Interface
export interface IOrder extends Document {
  orderNumber: string;
  customer: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  items: IOrderItem[];

  // Pricing
  subtotal: number;
  discount: number;
  discountCode?: string;
  tax: number;
  taxRate: number;
  shippingCost: number;
  total: number;

  // Shipping
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  shippingMethod: string;
  trackingNumber?: string;

  // Payment
  paymentInfo: IPaymentInfo;

  // Status
  orderStatus:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  fulfillmentStatus: "unfulfilled" | "partially_fulfilled" | "fulfilled";

  // Notes
  customerNote?: string;
  internalNote?: string;

  // Timestamps
  orderDate: Date;
  processedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  productImage: {
    type: String,
  },
  sku: {
    type: String,
    required: true,
  },
  variant: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"],
  },
  price: {
    type: Number,
    required: true,
    min: [0, "Price cannot be negative"],
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, "Discount cannot be negative"],
  },
  total: {
    type: Number,
    required: true,
  },
});

const shippingAddressSchema = new Schema({
  fullName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  addressLine1: {
    type: String,
    required: true,
  },
  addressLine2: {
    type: String,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
    default: "Bangladesh",
  },
});

const paymentInfoSchema = new Schema({
  method: {
    type: String,
    enum: [
      "cash_on_delivery",
      "card",
      "bank_transfer",
      "mobile_payment",
      "paypal",
      "stripe",
    ],
    required: true,
  },
  transactionId: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  paidAt: {
    type: Date,
  },
});

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },

    items: [orderItemSchema],

    // Pricing
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    discountCode: {
      type: String,
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, "Tax rate cannot be negative"],
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: [0, "Shipping cost cannot be negative"],
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },

    // Shipping
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    billingAddress: {
      type: shippingAddressSchema,
    },
    shippingMethod: {
      type: String,
      required: true,
      default: "Standard Shipping",
    },
    trackingNumber: {
      type: String,
    },

    // Payment
    paymentInfo: {
      type: paymentInfoSchema,
      required: true,
    },

    // Status
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },
    fulfillmentStatus: {
      type: String,
      enum: ["unfulfilled", "partially_fulfilled", "fulfilled"],
      default: "unfulfilled",
    },

    // Notes
    customerNote: {
      type: String,
      maxlength: [1000, "Customer note cannot exceed 1000 characters"],
    },
    internalNote: {
      type: String,
      maxlength: [1000, "Internal note cannot exceed 1000 characters"],
    },

    // Timestamps
    orderDate: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ "paymentInfo.status": 1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ trackingNumber: 1 });

// Pre-save middleware to generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    // Count orders today to generate sequential number
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await mongoose.model("Order").countDocuments({
      createdAt: { $gte: today },
    });

    const sequence = (count + 1).toString().padStart(4, "0");
    this.orderNumber = `ORD-${year}${month}${day}-${sequence}`;
  }
  next();
});

// Virtual for total items
orderSchema.virtual("totalItems").get(function () {
  if (!this.items) return 0;
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual for is paid
orderSchema.virtual("isPaid").get(function () {
  return this.paymentInfo?.status === "completed";
});

// Virtual for can cancel
orderSchema.virtual("canCancel").get(function () {
  return this.orderStatus && ["pending", "processing"].includes(this.orderStatus);
});

// Virtual for can refund
orderSchema.virtual("canRefund").get(function () {
  return (
    this.orderStatus === "delivered" && this.paymentInfo?.status === "completed"
  );
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

const Order =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);

export default Order;
