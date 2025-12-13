import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth"; // Import AuthRequest
import Order from "../modal/order";
import Product from "../modal/product";
import User from "../modal/user";

// Get all orders with pagination and filters (Admin/Staff)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      orderStatus,
      paymentStatus,
      fulfillmentStatus,
      search,
      startDate,
      endDate,
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Filter by order status
    if (orderStatus) {
      query.orderStatus = orderStatus;
    }

    // Filter by payment status
    if (paymentStatus) {
      query["paymentInfo.status"] = paymentStatus;
    }

    // Filter by fulfillment status
    if (fulfillmentStatus) {
      query.fulfillmentStatus = fulfillmentStatus;
    }

    // Date range filter
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate as string);
      if (endDate) query.orderDate.$lte = new Date(endDate as string);
    }

    // Search
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { trackingNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const orders = await Order.find(query)
      .populate("customer", "name email avatar")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(query);

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
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// Get authenticated user's orders (Customer)
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.userId;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find({ customer: userId })
      .sort({ orderDate: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments({ customer: userId });

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
      message: "Error fetching your orders",
      error: error.message,
    });
  }
};

// Get single order (Secured)
export const getOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const query = id.startsWith("ORD-") ? { orderNumber: id } : { _id: id };

    const order = await Order.findOne(query)
      .populate("customer", "name email phone avatar")
      .populate("items.product", "name images");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check ownership or admin/staff role
    if (order.customer._id.toString() !== userId && userRole !== "admin" && userRole !== "staff") {
       return res.status(403).json({
         success: false,
         message: "You are not authorized to view this order",
       });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    });
  }
};

// Create new order
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingMethod,
      customerNote,
    } = req.body;

    // Use authenticated user ID if available
    const customerId = req.user?.userId;

    // Validate items and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      if (product.trackInventory && product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const itemTotal = product.price * item.quantity - (item.discount || 0);
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        productName: product.name,
        productImage: product.images[0]?.url,
        sku: product.sku,
        variant: item.variant,
        quantity: item.quantity,
        price: product.price,
        discount: item.discount || 0,
        total: itemTotal,
      });

      // Update product stock
      if (product.trackInventory) {
        product.stock -= item.quantity;
        product.totalSales += item.quantity;
        await product.save();
      }
    }

    // Calculate tax and shipping
    const taxRate = 0; // Set your tax rate
    const tax = subtotal * taxRate;
    const shippingCost = 0; // Set shipping cost logic
    const total = subtotal + tax + shippingCost;

    // Get customer info
    console.log("Looking up customer with ID:", customerId);
    const customerData = await User.findById(customerId);

    if (!customerData) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Generate Order Number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await Order.countDocuments({
      createdAt: { $gte: today },
    });

    const sequence = (count + 1).toString().padStart(4, "0");
    const orderNumber = `ORD-${year}${month}${day}-${sequence}`;

    // Create order
    const order = await Order.create({
      orderNumber,
      customer: customerId,
      customerName: customerData.name,
      customerEmail: customerData.email,
      customerPhone: customerData.phone || shippingAddress.phone,
      items: orderItems,
      subtotal,
      tax,
      taxRate,
      shippingCost,
      total,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      shippingMethod: shippingMethod || "Standard Shipping",
      paymentInfo: {
        method: paymentMethod,
        status: "pending",
      },
      customerNote,
    });

    // Update customer stats
    customerData.totalOrders += 1;
    customerData.totalSpent += total;
    customerData.lastOrderDate = new Date();
    await customerData.save();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error: any) {
    console.error("Create Order Error Detailed:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating order",
      error: error.message,
    });
  }
};

// Update order (Admin/Staff) - Edit details
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Allow updating address, notes, tracking, status
    const updateData = req.body;

    // Prevent updating items or totals directly via this route to avoid consistency issues
    delete updateData.items;
    delete updateData.subtotal;
    delete updateData.total;
    delete updateData.customer; // Cannot change customer

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating order",
      error: error.message,
    });
  }
};

// Delete order (Admin/Staff)
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Restore stock if order was not cancelled/refunded (which already restored stock)
    if (
      order.orderStatus !== "cancelled" &&
      order.orderStatus !== "refunded" &&
      order.orderStatus !== "delivered" // Usually don't restore stock for delivered unless returned, but here we assume delete = void
    ) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity, totalSales: -item.quantity },
        });
      }
    }

    // Update customer stats
    if (order.orderStatus !== "cancelled" && order.orderStatus !== "refunded") {
       await User.findByIdAndUpdate(order.customer, {
         $inc: { totalOrders: -1, totalSpent: -order.total },
       });
    }

    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message,
    });
  }
};

// Update order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orderStatus, fulfillmentStatus, trackingNumber, internalNote } =
      req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order status
    if (orderStatus) {
      order.orderStatus = orderStatus;

      // Update timestamps
      if (orderStatus === "processing") {
        order.processedAt = new Date();
      } else if (orderStatus === "shipped") {
        order.shippedAt = new Date();
        order.fulfillmentStatus = "fulfilled";
      } else if (orderStatus === "delivered") {
        order.deliveredAt = new Date();
      } else if (orderStatus === "cancelled") {
        order.cancelledAt = new Date();

        // Restore product stock
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity, totalSales: -item.quantity },
          });
        }

        // Update customer stats
        await User.findByIdAndUpdate(order.customer, {
          $inc: { totalOrders: -1, totalSpent: -order.total },
        });
      }
    }

    if (fulfillmentStatus) {
      order.fulfillmentStatus = fulfillmentStatus;
    }

    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    if (internalNote) {
      order.internalNote = internalNote;
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating order",
      error: error.message,
    });
  }
};

// Update payment status
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, transactionId } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.paymentInfo.status = status;
    if (transactionId) {
      order.paymentInfo.transactionId = transactionId;
    }

    if (status === "completed") {
      order.paymentInfo.paidAt = new Date();
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating payment status",
      error: error.message,
    });
  }
};

// Refund order
export const refundOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.orderStatus !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Can only refund delivered orders",
      });
    }

    // Update order status
    order.orderStatus = "refunded";
    order.paymentInfo.status = "refunded";
    if (reason) {
      order.internalNote = `Refund reason: ${reason}`;
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, totalSales: -item.quantity },
      });
    }

    // Update customer stats
    await User.findByIdAndUpdate(order.customer, {
      $inc: { totalSpent: -order.total },
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order refunded successfully",
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error refunding order",
      error: error.message,
    });
  }
};

// Get order statistics
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.orderDate = {};
      if (startDate) dateFilter.orderDate.$gte = new Date(startDate as string);
      if (endDate) dateFilter.orderDate.$lte = new Date(endDate as string);
    }

    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      revenue,
    ] = await Promise.all([
      Order.countDocuments(dateFilter),
      Order.countDocuments({ ...dateFilter, orderStatus: "pending" }),
      Order.countDocuments({ ...dateFilter, orderStatus: "processing" }),
      Order.countDocuments({ ...dateFilter, orderStatus: "shipped" }),
      Order.countDocuments({ ...dateFilter, orderStatus: "delivered" }),
      Order.countDocuments({ ...dateFilter, orderStatus: "cancelled" }),
      Order.aggregate([
        { $match: { ...dateFilter, orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        revenue: revenue[0]?.total || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching order statistics",
      error: error.message,
    });
  }
};

// Get recent orders
export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const orders = await Order.find()
      .populate("customer", "name email avatar")
      .sort({ orderDate: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching recent orders",
      error: error.message,
    });
  }
};