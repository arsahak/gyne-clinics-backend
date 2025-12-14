import crypto from "crypto";
import { Request, Response } from "express";
import { generateAccessToken, TokenPayload } from "../config/jwt";
import { AuthRequest } from "../middleware/auth";
import Customer from "../modal/customer";
import Order from "../modal/order";

// Get all customers with pagination and filters
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const customers = await Customer.find(query)
      .select("-password")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Customer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: error.message,
    });
  }
};

// Get single customer
export const getCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id).select("-password");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Get customer orders
    const orders = await Order.find({ customer: id })
      .sort({ orderDate: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        ...customer.toObject(),
        recentOrders: orders,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching customer",
      error: error.message,
    });
  }
};

// ============================================
// CUSTOMER AUTHENTICATION (Public Routes)
// ============================================

// Customer Signup
export const customerSignup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, billingAddress, shippingAddress } =
      req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: "Customer with this email already exists",
      });
    }

    // Prepare addresses
    const billingAddresses: any[] = [];
    const shippingAddresses: any[] = [];

    // Add billing address if provided
    if (billingAddress) {
      billingAddresses.push({
        ...billingAddress,
        addressType: "billing",
        isDefaultBilling: true,
        isDefaultShipping: false,
      });
    }

    // Add shipping address if provided
    if (shippingAddress) {
      const isSameAsBilling =
        JSON.stringify(billingAddress) === JSON.stringify(shippingAddress);

      if (isSameAsBilling && billingAddress) {
        // Update billing address to "both" type
        if (billingAddresses.length > 0) {
          billingAddresses[0].addressType = "both";
          billingAddresses[0].isDefaultShipping = true;
        }
      } else {
        shippingAddresses.push({
          ...shippingAddress,
          addressType: "shipping",
          isDefaultBilling: false,
          isDefaultShipping: true,
        });
      }
    }

    // Create customer
    const customer = await Customer.create({
      name,
      email,
      password,
      phone,
      billingAddresses,
      shippingAddresses,
    });

    // Generate access token
    const tokenPayload: TokenPayload = {
      userId: customer._id.toString(),
      email: customer.email,
      role: "customer",
    };

    const tokenData = generateAccessToken(tokenPayload);

    // Customer response (without password)
    const customerResponse = customer.toObject();
    delete customerResponse.password;

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      data: customerResponse,
      accessToken: tokenData.accessToken,
      tokenExpiresAt: tokenData.expiresAt,
      tokenExpiresIn: tokenData.expiresIn,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating customer",
      error: error.message,
    });
  }
};

// Customer Signin
export const customerSignin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find customer and include password field
    const customer = await Customer.findOne({ email }).select("+password");

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!customer.password) {
      return res.status(401).json({
        success: false,
        message: "Please sign in with your social account",
      });
    }

    // Verify password
    const isPasswordValid = await customer.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate access token
    const tokenPayload: TokenPayload = {
      userId: customer._id.toString(),
      email: customer.email,
      role: "customer",
    };

    const tokenData = generateAccessToken(tokenPayload);

    // Customer response (without password)
    const customerResponse = customer.toObject();
    delete customerResponse.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: customerResponse,
      accessToken: tokenData.accessToken,
      tokenExpiresAt: tokenData.expiresAt,
      tokenExpiresIn: tokenData.expiresIn,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error signing in",
      error: error.message,
    });
  }
};

// Forgot Password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      });
    }

    const customer = await Customer.findOne({ email });

    if (!customer) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    customer.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    customer.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await customer.save({ validateBeforeSave: false });

    // TODO: Send email with reset token
    // For now, return token (remove in production)
    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/customers/reset-password/${resetToken}`;

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
      resetToken:
        process.env.NODE_ENV === "development" ? resetToken : undefined,
      resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error processing forgot password request",
      error: error.message,
    });
  }
};

// Reset Password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide token and new password",
      });
    }

    // Hash token to compare
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const customer = await Customer.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Set new password
    customer.password = password;
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpire = undefined;

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: error.message,
    });
  }
};

// Update Password (Authenticated)
export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current password and new password",
      });
    }

    const customer = await Customer.findById(req.user?.userId).select(
      "+password"
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Verify current password
    const isPasswordValid = await customer.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    customer.password = newPassword;
    await customer.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating password",
      error: error.message,
    });
  }
};

// ============================================
// CUSTOMER PROFILE MANAGEMENT (Authenticated)
// ============================================

// Get Current Customer Profile
export const getCurrentCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const customer = await Customer.findById(req.user?.userId).select(
      "-password"
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Get customer orders
    const orders = await Order.find({ customer: customer._id })
      .sort({ orderDate: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        ...customer.toObject(),
        recentOrders: orders,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer profile",
      error: error.message,
    });
  }
};

// Update Current Customer Profile
export const updateCurrentCustomer = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password;
    delete updateData.role;

    const customer = await Customer.findByIdAndUpdate(
      req.user?.userId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: customer,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN ROUTES (Keep existing functions)
// ============================================

// Create customer (Admin only)
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const customerData = {
      ...req.body,
      role: "customer",
    };

    const customer = await Customer.create(customerData);

    const customerResponse = customer.toObject();
    delete customerResponse.password;

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customerResponse,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error creating customer",
      error: error.message,
    });
  }
};

// Update customer
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Remove password from update if present
    const updateData = { ...req.body };
    delete updateData.password;

    const customer = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating customer",
      error: error.message,
    });
  }
};

// Delete customer
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check if customer has orders
    const orderCount = await Order.countDocuments({ customer: id });
    if (orderCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete customer with orders. Consider archiving instead.",
      });
    }

    await Customer.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error deleting customer",
      error: error.message,
    });
  }
};

// Get customer statistics
export const getCustomerStats = async (_req: Request, res: Response) => {
  try {
    const [totalCustomers, newCustomersThisMonth, topCustomers] =
      await Promise.all([
        Customer.countDocuments(),
        Customer.countDocuments({
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        }),
        Customer.find().sort({ totalSpent: -1 }).limit(10).select("-password"),
      ]);

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        newCustomersThisMonth,
        topCustomers,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer statistics",
      error: error.message,
    });
  }
};

// Get customer orders
export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find({ customer: id })
      .sort({ orderDate: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments({ customer: id });

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer orders",
      error: error.message,
    });
  }
};

// Add address to customer (Admin or Customer themselves)
export const addCustomerAddress = async (
  req: Request | AuthRequest,
  res: Response
) => {
  try {
    const customerId =
      (req as AuthRequest).user?.userId || (req as Request).params.id;
    const addressData = req.body;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Determine which address array to use
    const addressType = addressData.addressType || "both";
    const isBilling = addressType === "billing" || addressType === "both";
    const isShipping = addressType === "shipping" || addressType === "both";

    // Handle default flags
    if (addressData.isDefaultBilling && isBilling) {
      customer.billingAddresses.forEach((addr: any) => {
        addr.isDefaultBilling = false;
      });
      addressData.isDefaultBilling = true;
    }

    if (addressData.isDefaultShipping && isShipping) {
      customer.shippingAddresses.forEach((addr: any) => {
        addr.isDefaultShipping = false;
      });
      addressData.isDefaultShipping = true;
    }

    // If first address, set as defaults
    if (customer.billingAddresses.length === 0 && isBilling) {
      addressData.isDefaultBilling = true;
    }
    if (customer.shippingAddresses.length === 0 && isShipping) {
      addressData.isDefaultShipping = true;
    }

    // Add to appropriate array(s)
    if (isBilling) {
      customer.billingAddresses.push(addressData);
    }
    if (isShipping && addressType !== "both") {
      customer.shippingAddresses.push(addressData);
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error adding address",
      error: error.message,
    });
  }
};

// Add address to current customer (Authenticated)
export const addCurrentCustomerAddress = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const addressData = req.body;

    const customer = await Customer.findById(req.user?.userId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Determine which address array to use
    const addressType = addressData.addressType || "both";
    const isBilling = addressType === "billing" || addressType === "both";
    const isShipping = addressType === "shipping" || addressType === "both";

    // Handle default flags
    if (addressData.isDefaultBilling && isBilling) {
      customer.billingAddresses.forEach((addr: any) => {
        addr.isDefaultBilling = false;
      });
      addressData.isDefaultBilling = true;
    }

    if (addressData.isDefaultShipping && isShipping) {
      customer.shippingAddresses.forEach((addr: any) => {
        addr.isDefaultShipping = false;
      });
      addressData.isDefaultShipping = true;
    }

    // If first address, set as defaults
    if (customer.billingAddresses.length === 0 && isBilling) {
      addressData.isDefaultBilling = true;
    }
    if (customer.shippingAddresses.length === 0 && isShipping) {
      addressData.isDefaultShipping = true;
    }

    // Add to appropriate array(s)
    if (isBilling) {
      customer.billingAddresses.push(addressData);
    }
    if (isShipping && addressType !== "both") {
      customer.shippingAddresses.push(addressData);
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error adding address",
      error: error.message,
    });
  }
};

// Update customer address (Admin or Customer themselves)
export const updateCustomerAddress = async (
  req: Request | AuthRequest,
  res: Response
) => {
  try {
    const customerId =
      (req as AuthRequest).user?.userId || (req as Request).params.id;
    const addressId =
      (req as Request).params?.addressId || (req as any).params?.addressId;
    const addressData = req.body;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Find address in billing or shipping arrays
    let addressIndex = customer.billingAddresses.findIndex(
      (addr: any) => addr._id.toString() === addressId
    );
    let addressArray = customer.billingAddresses;
    let isBillingArray = true;

    if (addressIndex === -1) {
      addressIndex = customer.shippingAddresses.findIndex(
        (addr: any) => addr._id.toString() === addressId
      );
      addressArray = customer.shippingAddresses;
      isBillingArray = false;
    }

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Handle default flags
    if (addressData.isDefaultBilling && isBillingArray) {
      customer.billingAddresses.forEach((addr: any, idx: number) => {
        if (idx !== addressIndex) {
          addr.isDefaultBilling = false;
        }
      });
    }

    if (addressData.isDefaultShipping && !isBillingArray) {
      customer.shippingAddresses.forEach((addr: any, idx: number) => {
        if (idx !== addressIndex) {
          addr.isDefaultShipping = false;
        }
      });
    }

    addressArray[addressIndex] = {
      ...addressArray[addressIndex],
      ...addressData,
    };

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating address",
      error: error.message,
    });
  }
};

// Update current customer address (Authenticated)
export const updateCurrentCustomerAddress = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { addressId } = req.params;
    const addressData = req.body;

    const customer = await Customer.findById(req.user?.userId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Find address in billing or shipping arrays
    let addressIndex = customer.billingAddresses.findIndex(
      (addr: any) => addr._id.toString() === addressId
    );
    let addressArray = customer.billingAddresses;
    let isBillingArray = true;

    if (addressIndex === -1) {
      addressIndex = customer.shippingAddresses.findIndex(
        (addr: any) => addr._id.toString() === addressId
      );
      addressArray = customer.shippingAddresses;
      isBillingArray = false;
    }

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Handle default flags
    if (addressData.isDefaultBilling && isBillingArray) {
      customer.billingAddresses.forEach((addr: any, idx: number) => {
        if (idx !== addressIndex) {
          addr.isDefaultBilling = false;
        }
      });
    }

    if (addressData.isDefaultShipping && !isBillingArray) {
      customer.shippingAddresses.forEach((addr: any, idx: number) => {
        if (idx !== addressIndex) {
          addr.isDefaultShipping = false;
        }
      });
    }

    addressArray[addressIndex] = {
      ...addressArray[addressIndex],
      ...addressData,
    };

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating address",
      error: error.message,
    });
  }
};

// Delete customer address (Admin or Customer themselves)
export const deleteCustomerAddress = async (
  req: Request | AuthRequest,
  res: Response
) => {
  try {
    const customerId =
      (req as AuthRequest).user?.userId || (req as Request).params.id;
    const addressId = (req as Request).params.addressId;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Find address in billing or shipping arrays
    let addressIndex = customer.billingAddresses.findIndex(
      (addr: any) => addr._id.toString() === addressId
    );
    let addressArray = customer.billingAddresses;
    let isBillingArray = true;

    if (addressIndex === -1) {
      addressIndex = customer.shippingAddresses.findIndex(
        (addr: any) => addr._id.toString() === addressId
      );
      addressArray = customer.shippingAddresses;
      isBillingArray = false;
    }

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const deletedAddress = addressArray[addressIndex] as any;
    const wasDefaultBilling = deletedAddress.isDefaultBilling;
    const wasDefaultShipping = deletedAddress.isDefaultShipping;

    addressArray.splice(addressIndex, 1);

    // If deleted address was default, set first matching address as default
    if (wasDefaultBilling && customer.billingAddresses.length > 0) {
      customer.billingAddresses[0].isDefaultBilling = true;
    }

    if (wasDefaultShipping && customer.shippingAddresses.length > 0) {
      customer.shippingAddresses[0].isDefaultShipping = true;
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error deleting address",
      error: error.message,
    });
  }
};

// Delete current customer address (Authenticated)
export const deleteCurrentCustomerAddress = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { addressId } = req.params;

    const customer = await Customer.findById(req.user?.userId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Find address in billing or shipping arrays
    let addressIndex = customer.billingAddresses.findIndex(
      (addr: any) => addr._id.toString() === addressId
    );
    let addressArray = customer.billingAddresses;
    let isBillingArray = true;

    if (addressIndex === -1) {
      addressIndex = customer.shippingAddresses.findIndex(
        (addr: any) => addr._id.toString() === addressId
      );
      addressArray = customer.shippingAddresses;
      isBillingArray = false;
    }

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const deletedAddress = addressArray[addressIndex] as any;
    const wasDefaultBilling = deletedAddress.isDefaultBilling;
    const wasDefaultShipping = deletedAddress.isDefaultShipping;

    addressArray.splice(addressIndex, 1);

    // If deleted address was default, set first matching address as default
    if (wasDefaultBilling && customer.billingAddresses.length > 0) {
      customer.billingAddresses[0].isDefaultBilling = true;
    }

    if (wasDefaultShipping && customer.shippingAddresses.length > 0) {
      customer.shippingAddresses[0].isDefaultShipping = true;
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: customer,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error deleting address",
      error: error.message,
    });
  }
};
