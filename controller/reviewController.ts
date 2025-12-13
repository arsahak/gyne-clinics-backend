import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Order from "../modal/order";
// Product is dynamically imported to avoid circular dependency issues if any
import Review from "../modal/review";
import User from "../modal/user"; // Import User to fetch name

// Get reviews (Public/Admin)
export const getReviews = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      product,
      customer,
      status,
      rating,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    if (product) query.product = product;
    if (customer) query.customer = customer;
    if (status) query.status = status;
    if (rating) query.rating = rating;

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const reviews = await Review.find(query)
      .populate("customer", "name avatar")
      .populate("product", "name slug images")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      data: reviews,
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
      message: "Error fetching reviews",
      error: error.message,
    });
  }
};

// Create review (Customer)
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { product: productId, order: orderId, rating, comment, title, images } = req.body;
    const userId = req.user?.userId;
    
    // Fetch user to get name
    const user = await User.findById(userId);
    const userName = user?.name || "Customer";

    // 1. Verify Order
    const order = await Order.findOne({
      _id: orderId,
      customer: userId,
      orderStatus: "delivered", // Must be delivered
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not found or not delivered yet. You can only review products from delivered orders.",
      });
    }

    // 2. Verify Product is in Order
    const hasProduct = order.items.some(
      (item: any) => item.product.toString() === productId
    );

    if (!hasProduct) {
      return res.status(400).json({
        success: false,
        message: "This product was not found in the specified order.",
      });
    }

    // 3. Check for existing review
    const existingReview = await Review.findOne({
      product: productId,
      customer: userId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product.",
      });
    }

    // 4. Create Review
    const review = await Review.create({
      product: productId,
      customer: userId,
      customerName: userName,
      order: orderId,
      rating,
      title,
      comment,
      images,
      isVerifiedPurchase: true,
      status: "pending", // Default to pending for moderation
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully! It is pending approval.",
      data: review,
    });
  } catch (error: any) {
    if (error.code === 11000) {
        return res.status(400).json({
            success: false,
            message: "You have already reviewed this product.",
        });
    }
    return res.status(500).json({
      success: false,
      message: "Error creating review",
      error: error.message,
    });
  }
};

// Update review status (Admin)
export const updateReviewStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.status = status;
    await review.save(); // Triggers post-save hook to update product rating

    return res.status(200).json({
      success: true,
      message: `Review ${status} successfully`,
      data: review,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating review status",
      error: error.message,
    });
  }
};

// Delete review (Admin)
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.status === 'approved') {
        const Product = (await import("../modal/product")).default;
        const reviews = await Review.find({
            product: review.product,
            status: "approved",
        });

        const totalReviews = reviews.length;
        const averageRating = totalReviews > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
            : 0;

        await Product.findByIdAndUpdate(review.product, {
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews,
        });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error deleting review",
      error: error.message,
    });
  }
};

// Reply to review (Admin)
export const replyToReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const userId = req.user?.userId;

        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        review.response = {
            text,
            respondedBy: userId,
            respondedAt: new Date()
        };

        await review.save();

        return res.status(200).json({
            success: true,
            message: "Reply added successfully",
            data: review
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error replying to review",
            error: error.message,
        });
    }
}