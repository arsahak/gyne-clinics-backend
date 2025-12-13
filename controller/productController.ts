import { Response } from "express";
import fs from "fs";
import { AuthRequest } from "../middleware/auth";
import Category from "../modal/category";
import Product from "../modal/product";
import { uploadToImgBB } from "../utils/uploadToImgBB";

// Get all products with pagination and filters
export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      featured,
      minPrice,
      maxPrice,
    } = req.query;

    const query: any = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by featured
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search as string, "i")] } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("createdBy", "name email")
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// Get single product by ID or slug
export const getProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id };

    const product = await Product.findOne(query)
      .populate("category", "name slug")
      .populate("createdBy", "name email");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error("Error fetching product:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

// Create new product
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    console.log("Create Product Request Body:", req.body);
    console.log("Create Product Request Files:", req.files);

    const files = req.files as Express.Multer.File[];
    const images: any[] = [];

    // Upload images to ImgBB
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          console.log(`Uploading file: ${file.path}`);
          const imageUrl = await uploadToImgBB(file.path);
          console.log(`Uploaded successfully: ${imageUrl}`);
          images.push({
            url: imageUrl,
            isPrimary: images.length === 0, // First image is primary by default
          });
          // Delete temp file
          fs.unlinkSync(file.path);
        } catch (uploadError: any) {
          console.error("Image upload failed:", uploadError);
          // Try to delete temp file if it exists
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }
      }
    }

    const productData = {
      ...req.body,
      images, // Add uploaded images
      createdBy: req.user?.userId,
    };

    // Hotfix for stale frontend: Replace invalid ID or empty string if found
    if (
      productData.category === "6578a1b2c3d4e5f6g7h8i9j0" ||
      productData.category === ""
    ) {
      console.warn("Hotfix: Replacing invalid/empty category ID.");
      productData.category = "6578a1b2c3d4e5f6a7b8c9d0";
    }

    // Generate slug if not present
    if (!productData.slug && productData.name) {
      productData.slug = productData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Parse numeric/boolean fields if they are strings (from FormData)
    if (productData.price) productData.price = Number(productData.price);
    if (productData.compareAtPrice)
      productData.compareAtPrice = Number(productData.compareAtPrice);
    if (productData.stock) productData.stock = Number(productData.stock);
    if (productData.featured)
      productData.featured =
        productData.featured === "true" || productData.featured === true;

    // Validate category (optional: check if it's a valid ObjectId)
    // if (!mongoose.Types.ObjectId.isValid(productData.category)) { ... }

    console.log("Saving product data:", productData);
    const product = await Product.create(productData);
    console.log("Product saved:", product._id);

    // Update category product count
    try {
        await Category.findByIdAndUpdate(product.category, {
        $inc: { productsCount: 1 },
        });
    } catch (catError) {
        console.warn("Failed to update category count:", catError);
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error: any) {
    console.error("Error creating product:", error);
    
    // Cleanup files if error occurs before they were processed/deleted
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      files.forEach((file) => {
        try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (e) { console.error("Error deleting file:", e); }
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

// Update product
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const oldProduct = await Product.findById(id);

    if (!oldProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const files = req.files as Express.Multer.File[];
    let newImages: any[] = [];

    // Upload new images to ImgBB
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const imageUrl = await uploadToImgBB(file.path);
          newImages.push({
            url: imageUrl,
            isPrimary: false,
          });
          fs.unlinkSync(file.path);
        } catch (uploadError) {
          console.error("Image upload failed:", uploadError);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }
    }

    let finalImages = [...oldProduct.images];

    // Handle kept images
    // The frontend should send `keptImages` as an array of URLs or JSON string
    if (req.body.keptImages) {
      let keptImages = req.body.keptImages;
      // Parse if string
      if (typeof keptImages === "string") {
        try {
          keptImages = JSON.parse(keptImages);
        } catch (e) {
          keptImages = [keptImages];
        }
      }
      
      if (Array.isArray(keptImages)) {
          finalImages = oldProduct.images.filter((img: any) =>
            keptImages.includes(img.url)
          );
      }
    }
    
    // Add new images
    finalImages = [...finalImages, ...newImages];

    // Ensure one primary
    if (finalImages.length > 0) {
      const hasPrimary = finalImages.some((img: any) => img.isPrimary);
      if (!hasPrimary) {
        finalImages[0].isPrimary = true;
      }
    }

    const updateData = {
      ...req.body,
      images: finalImages,
    };

    // Hotfix for stale frontend: Replace invalid ID or empty string if found
    if (
      updateData.category === "6578a1b2c3d4e5f6g7h8i9j0" ||
      updateData.category === ""
    ) {
      console.warn("Hotfix: Replacing invalid/empty category ID.");
      updateData.category = "6578a1b2c3d4e5f6a7b8c9d0";
    }

    // Parse numeric/boolean fields
    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.compareAtPrice)
      updateData.compareAtPrice = Number(updateData.compareAtPrice);
    if (updateData.stock) updateData.stock = Number(updateData.stock);
    if (updateData.featured !== undefined)
      updateData.featured =
        updateData.featured === "true" || updateData.featured === true;

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("category", "name slug");

    // Update category counts if category changed
    const oldCategoryId = oldProduct.category ? oldProduct.category.toString() : null;
    const newCategoryId = product && product.category 
        ? (typeof product.category === 'object' && '_id' in product.category ? product.category._id.toString() : product.category.toString()) 
        : null;

    if (oldCategoryId !== newCategoryId) {
      if (oldCategoryId) {
        await Category.findByIdAndUpdate(oldCategoryId, {
          $inc: { productsCount: -1 },
        });
      }
      if (newCategoryId) {
        await Category.findByIdAndUpdate(newCategoryId, {
          $inc: { productsCount: 1 },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error: any) {
    console.error("Error updating product:", error);
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      files.forEach((file) => {
        try {
             if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (e) {}
      });
    }
    return res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

// Delete product
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Update category product count
    await Category.findByIdAndUpdate(product.category, {
      $inc: { productsCount: -1 },
    });

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message,
    });
  }
};

// Bulk update products
export const bulkUpdateProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { productIds, updates } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs are required",
      });
    }

    await Product.updateMany({ _id: { $in: productIds } }, updates);

    return res.status(200).json({
      success: true,
      message: `${productIds.length} products updated successfully`,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating products",
      error: error.message,
    });
  }
};

// Get low stock products
export const getLowStockProducts = async (_req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find({
      trackInventory: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      status: "active",
    })
      .populate("category", "name")
      .sort({ stock: 1 });

    res.status(200).json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching low stock products",
      error: error.message,
    });
  }
};

// Update product stock
export const updateProductStock = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'

    if (!quantity || !operation) {
      return res.status(400).json({
        success: false,
        message: "Quantity and operation are required",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (operation === "add") {
      product.stock += Number(quantity);
    } else if (operation === "subtract") {
      if (product.stock < Number(quantity)) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock",
        });
      }
      product.stock -= Number(quantity);
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: product,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Error updating stock",
      error: error.message,
    });
  }
};