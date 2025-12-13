import { Request, Response } from "express";
import Category from "../modal/category";

// Get all categories with pagination, search, and filters
export const getCategories = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      parent,
      search,
      sortBy = "sortOrder",
      sortOrder = "asc",
    } = req.query;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (parent !== undefined) {
      query.parent = parent === "null" || parent === "" ? null : parent;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Additional sort by name to ensure consistent order
    if (sortBy !== "name") {
      sort["name"] = 1;
    }

    const categories = await Category.find(query)
      .populate("parent", "name slug")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Category.countDocuments(query);

    res.status(200).json({
      success: true,
      data: categories,
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
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get single category
export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id };

    const category = await Category.findOne(query)
      .populate("parent", "name slug")
      .populate({
        path: "subcategories",
        select: "name slug image productsCount",
      });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message,
    });
  }
};

// Create category
export const createCategory = async (req: Request, res: Response) => {
  try {
    // If parent is empty string, set to null
    if (req.body.parent === "") {
        req.body.parent = null;
    }

    // Auto-generate slug if not provided
    if (!req.body.slug && req.body.name) {
      req.body.slug = req.body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    
    const category = await Category.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === 11000) {
       const field = Object.keys(error.keyPattern)[0];
       return res.status(400).json({
         success: false,
         message: `Category ${field} already exists`,
         error: error.message,
       });
    }

    console.error("Error creating category:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating category",
      error: error.message,
    });
  }
};

// Update category
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // If parent is empty string, set to null
    if (req.body.parent === "") {
        req.body.parent = null;
    }

    // Prevent setting parent to itself
    if (req.body.parent === id) {
        return res.status(400).json({
            success: false,
            message: "Category cannot be its own parent",
        });
    }

    const category = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error: any) {
     if (error.code === 11000) {
       const field = Object.keys(error.keyPattern)[0];
       return res.status(400).json({
         success: false,
         message: `Category ${field} already exists`,
         error: error.message,
       });
    }
    return res.status(500).json({
      success: false,
      message: "Error updating category",
      error: error.message,
    });
  }
};

// Delete category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has products
    if (category.productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category containing ${category.productsCount} products. Please reassign or delete products first.`,
      });
    }

    // Check if category has subcategories
    const subcategories = await Category.countDocuments({ parent: id });
    if (subcategories > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${subcategories} subcategories. Please reassign or delete subcategories first.`,
      });
    }

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message,
    });
  }
};

// Get category tree (hierarchical structure)
export const getCategoryTree = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find({ status: "active" })
      .populate({
        path: "subcategories",
        match: { status: "active" },
        select: "name slug image productsCount",
      })
      .sort({ sortOrder: 1, name: 1 });

    // Build tree structure (only top level)
    const tree = categories
      .filter((cat) => !cat.parent)
      .map((cat) => ({
        ...cat.toObject(),
        subcategories: categories.filter(
          (sub) => sub.parent?.toString() === cat._id.toString()
        ),
      }));

    res.status(200).json({
      success: true,
      data: tree,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching category tree",
      error: error.message,
    });
  }
};