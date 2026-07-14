"use client";

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { csrfHeader, ensureCsrfToken } from "@/lib/csrf";

export interface wishListProduct {
  productID: string;
  productName: string;
  productPrice: number;
  productReviews: string;
}

interface wishListState {
  itemsById: {
    [id: string]: wishListProduct;
  };
  itemIds: string[];
}

const initialState: wishListState = {
  itemsById: {},
  itemIds: []};

// Async thunks for database operations
export const addToWishlistAsync = createAsyncThunk(
  "wishlist/addToWishlistAsync",
  async (product: wishListProduct, { rejectWithValue }) => {
    try {
      await ensureCsrfToken();
      const response = await fetch("/api/wishlist", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeader(),
        },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error
            : null;
        throw new Error(details || "Failed to add to wishlist");
      }

      const data = await response.json();
      return product;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to add to wishlist");
    }
  }
);

export const removeFromWishlistAsync = createAsyncThunk(
  "wishlist/removeFromWishlistAsync",
  async (productID: string, { rejectWithValue }) => {
    try {
      await ensureCsrfToken();
      const response = await fetch("/api/wishlist", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeader(),
        },
        body: JSON.stringify({ productID }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        console.error(
          "removeFromWishlist backend error:",
          response.status,
          error
        );
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error
            : null;
        throw new Error(details || "Failed to remove from wishlist");
      }

      return productID;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to remove from wishlist");
    }
  }
);

export const fetchWishlistAsync = createAsyncThunk(
  "wishlist/fetchWishlistAsync",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("/api/wishlist", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return [];
        }
        const error = await response.json().catch(() => null);
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error
            : null;
        throw new Error(details || "Failed to fetch wishlist");
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch wishlist");
    }
  }
);

const wishListSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    addToWishlist(state, action: PayloadAction<wishListProduct>) {
      const product = action.payload;

      if (!state.itemsById[product.productID]) {
        state.itemsById[product.productID] = product;
        state.itemIds.push(product.productID);
      }
    },

    removeFromWishList(state, action: PayloadAction<string>) {
      const productID = action.payload;

      if (state.itemsById[productID]) {
        delete state.itemsById[productID];
        state.itemIds = state.itemIds.filter((pid) => pid !== productID);
      }
    },

    clearWishList(state) {
      state.itemIds = [];
      state.itemsById = {};
    },
    
    // Action to set wishlist from database
    setWishlist(state, action: PayloadAction<wishListProduct[]>) {
      state.itemsById = {};
      state.itemIds = [];
      
      action.payload.forEach((item) => {
        state.itemsById[item.productID] = item;
        state.itemIds.push(item.productID);
      });
    }},
  extraReducers: (builder) => {
    // Handle addToWishlistAsync
    builder
      .addCase(addToWishlistAsync.fulfilled, (state, action) => {
        const product = action.payload;
        if (!state.itemsById[product.productID]) {
          state.itemsById[product.productID] = product;
          state.itemIds.push(product.productID);
        }
      })
      .addCase(addToWishlistAsync.rejected, (state, action) => {
        console.error("Failed to add to wishlist:", action.payload);
      });

    // Handle removeFromWishlistAsync
    builder
      .addCase(removeFromWishlistAsync.fulfilled, (state, action) => {
        const productID = action.payload;
        if (state.itemsById[productID]) {
          delete state.itemsById[productID];
          state.itemIds = state.itemIds.filter((pid) => pid !== productID);
        }
      })
      .addCase(removeFromWishlistAsync.rejected, (state, action) => {
        console.error("Failed to remove from wishlist:", action.payload);
      });

    // Handle fetchWishlistAsync
    builder
      .addCase(fetchWishlistAsync.fulfilled, (state, action) => {
        state.itemsById = {};
        state.itemIds = [];

        action.payload.forEach((item: wishListProduct) => {
          state.itemsById[item.productID] = item;
          state.itemIds.push(item.productID);
        });
      })
      .addCase(fetchWishlistAsync.rejected, (state, action) => {
        console.error("Failed to fetch wishlist:", action.payload);
      });
  }});

export const { addToWishlist, removeFromWishList, clearWishList, setWishlist } =
  wishListSlice.actions;
export default wishListSlice.reducer;
