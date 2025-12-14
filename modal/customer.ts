import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";

export interface ICustomerAddress {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  addressType: "billing" | "shipping" | "both";
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

export interface ICustomer extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  isEmailVerified: boolean;

  // Addresses
  billingAddresses: ICustomerAddress[];
  shippingAddresses: ICustomerAddress[];

  // Wishlist
  wishlist: mongoose.Types.ObjectId[];

  // E-commerce stats
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;

  // Password reset
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const customerAddressSchema = new Schema<ICustomerAddress>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: "Bangladesh" },
    addressType: {
      type: String,
      enum: ["billing", "shipping", "both"],
      default: "both",
    },
    isDefaultBilling: { type: Boolean, default: false },
    isDefaultShipping: { type: Boolean, default: false },
  },
  { _id: true }
);

const customerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Addresses - Separate billing and shipping
    billingAddresses: [customerAddressSchema],
    shippingAddresses: [customerAddressSchema],

    // Wishlist
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // E-commerce stats
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastOrderDate: {
      type: Date,
    },

    // Password reset
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
customerSchema.index({ email: 1 });
customerSchema.index({ resetPasswordToken: 1 });

// Hash password before saving
customerSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
customerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for all addresses (billing + shipping combined)
customerSchema.virtual("addresses").get(function () {
  const allAddresses: any[] = [];

  // Add billing addresses
  this.billingAddresses.forEach((addr: any) => {
    allAddresses.push({
      ...addr,
      addressType: addr.addressType === "both" ? "billing" : addr.addressType,
    });
  });

  // Add shipping addresses (avoid duplicates if addressType is "both")
  this.shippingAddresses.forEach((addr: any) => {
    if (addr.addressType !== "both") {
      allAddresses.push({
        ...addr,
        addressType: "shipping",
      });
    }
  });

  return allAddresses;
});

const Customer =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
