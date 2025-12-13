import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Order from "../modal/order";
import Product from "../modal/product";
import User from "../modal/user";

// Get E-commerce Dashboard Statistics
export const getEcommerceStats = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Basic Counts
    const totalProducts = await Product.countDocuments({ status: "active" });
    const totalCustomers = await User.countDocuments({ role: "customer" });
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: "pending" });
    const lowStockProducts = await Product.countDocuments({
      trackInventory: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    });

    // Revenue Aggregation
    const revenueResult = await Order.aggregate([
      { $match: { orderStatus: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Recent Orders
    const recentOrders = await Order.find()
      .select("orderNumber customerName total orderStatus orderDate")
      .sort({ orderDate: -1 })
      .limit(5);

    // Top Products (by totalSales)
    const topProducts = await Product.find()
      .select("name totalSales price")
      .sort({ totalSales: -1 })
      .limit(5)
      .lean();

    const formattedTopProducts = topProducts.map((p: any) => ({
      name: p.name,
      totalSales: p.totalSales || 0,
      revenue: (p.totalSales || 0) * (p.price || 0),
    }));

    // Sales Data (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const salesDataRaw = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: sevenDaysAgo },
          orderStatus: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$orderDate" },
            month: { $month: "$orderDate" },
            day: { $dayOfMonth: "$orderDate" },
          },
          sales: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Format Sales Data
    const salesData = salesDataRaw.map((item) => {
      const date = new Date(item._id.year, item._id.month - 1, item._id.day);
      return {
        date: date.toLocaleDateString("en-US", { weekday: "short" }), // Mon, Tue...
        sales: item.sales,
        orders: item.orders,
      };
    });

    // Calculate Growth
    const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfPrevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const endOfPrevMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);

    const currentMonthRevenue = await Order.aggregate([
        { $match: { orderDate: { $gte: startOfCurrentMonth }, orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    const prevMonthRevenue = await Order.aggregate([
        { $match: { orderDate: { $gte: startOfPrevMonth, $lte: endOfPrevMonth }, orderStatus: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    const curRev = currentMonthRevenue[0]?.total || 0;
    const prevRev = prevMonthRevenue[0]?.total || 0;
    const revenueGrowth = prevRev === 0 ? (curRev > 0 ? 100 : 0) : ((curRev - prevRev) / prevRev) * 100;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRevenue,
          totalOrders,
          totalProducts,
          totalCustomers,
          revenueGrowth,
          ordersGrowth: 0, // Placeholder
          productsGrowth: 0, // Placeholder
          customersGrowth: 0, // Placeholder
          pendingOrders,
          lowStockProducts,
        },
        recentOrders,
        topProducts: formattedTopProducts,
        salesData,
      },
    });
  } catch (error: any) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};
