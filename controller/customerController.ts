import { Request, Response } from "express";
import Order from "../modal/order";
import User from "../modal/user";

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

    const query: any = { role: "customer" };

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

    const customers = await User.find(query)
      .select("-password")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

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

    const customer = await User.findById(id).select("-password");

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

// Create customer
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const customerData = {
      ...req.body,
      role: "customer",
    };

    const customer = await User.create(customerData);

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

    const customer = await User.findByIdAndUpdate(id, updateData, {
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

    const customer = await User.findById(id);

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

    await User.findByIdAndDelete(id);

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
        User.countDocuments({ role: "customer" }),
        User.countDocuments({
          role: "customer",
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        }),
        User.find({ role: "customer" })
          .sort({ totalSpent: -1 })
          .limit(10)
          .select("-password"),
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

// Add address to customer
export const addCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const addressData = req.body;

    const customer = await User.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // If this is the first address or marked as default, set it as default
    if (
      !customer.addresses ||
      customer.addresses.length === 0 ||
      addressData.isDefault
    ) {
      // Remove default from other addresses
      if (customer.addresses) {
        customer.addresses.forEach((addr: any) => {
          addr.isDefault = false;
        });
      }
      addressData.isDefault = true;
    }

    if (!customer.addresses) {
      customer.addresses = [];
    }

    customer.addresses.push(addressData);
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

// Update customer address
export const updateCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { id, addressId } = req.params;
    const addressData = req.body;

    const customer = await User.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (!customer.addresses) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const addressIndex = customer.addresses.findIndex(
      (addr: any) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If setting as default, remove default from others
    if (addressData.isDefault) {
      customer.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    customer.addresses[addressIndex] = {
      ...customer.addresses[addressIndex],
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

// Delete customer address
export const deleteCustomerAddress = async (req: Request, res: Response) => {
  try {
    const { id, addressId } = req.params;

    const customer = await User.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (!customer.addresses) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const addressIndex = customer.addresses.findIndex(
      (addr: any) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefault = (customer.addresses[addressIndex] as any).isDefault;
    customer.addresses.splice(addressIndex, 1);

    // If deleted address was default, set first address as default
    if (wasDefault && customer.addresses.length > 0) {
      (customer.addresses[0] as any).isDefault = true;
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
