"use client";

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { getToken, getUser } from "@/lib/auth";

export interface cartProduct {
  productID: string;
  productName: string;
  productPrice: number;
  productReviews: string;
  stockQuantity?: number;
  availableStock?: number;
  active?: boolean;
  purchasable?: boolean;
  quantity?: number;
}

interface cartState {
  itemsById: {
    [id: string]: cartProduct;
  };
  itemIds: string[];
  totalAmount: number;
}

const initialState: cartState = {
  itemsById: {},
  itemIds: [],
  totalAmount: 0,
};

const MAX_QUANTITY = 20;

function normalizeAuthorizationHeader(token: string | null): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const normalizedToken = trimmed.replace(/^Bearer\s+/i, "");
  return `Bearer ${normalizedToken}`;
}

function shouldSyncCartWithBackend(): boolean {
  return Boolean(getToken() || getUser());
}

// Async thunks for database operations
export const addToCartAsync = createAsyncThunk(
  "cart/addToCartAsync",
  async (product: Omit<cartProduct, "quantity">, { rejectWithValue }) => {
    try {
      if (!shouldSyncCartWithBackend()) {
        return { product, quantity: 1 };
      }

      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch("/api/cart", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error || (error as any).message
            : null;
        throw new Error(details || "Failed to add to cart");
      }

      const data = await response.json();
      return { product, quantity: data.quantity || 1 };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to add to cart");
    }
  }
);

export const removeFromCartAsync = createAsyncThunk(
  "cart/removeFromCartAsync",
  async (productID: string, { rejectWithValue }) => {
    try {
      if (!shouldSyncCartWithBackend()) {
        return productID;
      }

      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch("/api/cart", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
        body: JSON.stringify({ productID }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error || (error as any).message
            : null;
        throw new Error(details || "Failed to remove from cart");
      }

      return productID;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to remove from cart");
    }
  }
);

export const updateQuantityAsync = createAsyncThunk(
  "cart/updateQuantityAsync",
  async (
    { productID, quantity }: { productID: string; quantity: number },
    { rejectWithValue }
  ) => {
    try {
      if (!shouldSyncCartWithBackend()) {
        return { productID, quantity };
      }

      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch("/api/cart", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
        body: JSON.stringify({ productID, quantity }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        console.error(
          "updateQuantity backend error:",
          response.status,
          error
        );
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error || (error as any).message
            : null;
        throw new Error(details || "Failed to update quantity");
      }

      return { productID, quantity };
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to update quantity");
    }
  }
);

export const fetchCartAsync = createAsyncThunk(
  "cart/fetchCartAsync",
  async (_, { rejectWithValue }) => {
    try {
      if (!shouldSyncCartWithBackend()) {
        return [];
      }

      const authorizationHeader = normalizeAuthorizationHeader(getToken());
      const response = await fetch("/api/cart", {
        credentials: "include",
        headers: {
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return [];
        }
        const error = await response.json().catch(() => null);
        const details =
          error && typeof error === "object"
            ? (error as any).details || (error as any).error || (error as any).message
            : null;
        throw new Error(details || "Failed to fetch cart");
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch cart");
    }
  }
);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<Omit<cartProduct, "quantity">>) {
      const product = action.payload;
      const item = state.itemsById[product.productID];

      if (item) {
        if ((item.quantity ?? 0) < MAX_QUANTITY) {
          item.quantity = (item.quantity ?? 0) + 1;
          state.totalAmount += item.productPrice;
        }
      } else {
        state.itemsById[product.productID] = { ...product, quantity: 1 };
        state.itemIds.push(product.productID);
        state.totalAmount += state.itemsById[product.productID].productPrice;
      }
    },

    updateQuantity(
      state,
      action: PayloadAction<{ productID: string; quantity: number }>
    ) {
      const { productID, quantity } = action.payload;
      const item = state.itemsById[productID];

      if (!item) return;
      if (quantity <= 0) {
        cartSlice.caseReducers.removeFromCart(state, {
          payload: productID,
          type: "",
        });
        return;
      }

      const newQty = Math.min(quantity, MAX_QUANTITY);
      const difference = newQty - (item.quantity ?? 0);

      item.quantity = newQty;
      state.totalAmount += difference * item.productPrice;
    },

    removeFromCart(state, action: PayloadAction<string>) {
      const productID = action.payload;
      const item = state.itemsById[productID];

      if (item) {
        state.totalAmount -= item.productPrice * (item.quantity ?? 0);
        delete state.itemsById[productID];
        state.itemIds = state.itemIds.filter((pid) => pid !== productID);
      }
    },

    clearCart(state) {
      state.totalAmount = 0;
      state.itemsById = {};
      state.itemIds = [];
    },

    // Action to set cart from database
    setCart(state, action: PayloadAction<cartProduct[]>) {
      state.itemsById = {};
      state.itemIds = [];
      state.totalAmount = 0;

      action.payload.forEach((item) => {
        state.itemsById[item.productID] = {
          ...item,
          quantity: item.quantity || 1,
        };
        state.itemIds.push(item.productID);
        state.totalAmount += item.productPrice * (item.quantity || 1);
      });
    },
  },
  extraReducers: (builder) => {
    // Handle addToCartAsync
    builder
      .addCase(addToCartAsync.fulfilled, (state, action) => {
        const { product, quantity } = action.payload;
        const item = state.itemsById[product.productID];

        if (item) {
          if ((item.quantity ?? 0) < MAX_QUANTITY) {
            item.quantity += quantity;
            // Recalculate total
            state.totalAmount = 0;
            Object.values(state.itemsById).forEach((cartItem) => {
              state.totalAmount +=
                cartItem.productPrice * (cartItem.quantity || 1);
            });
          }
        } else {
          state.itemsById[product.productID] = { ...product, quantity };
          state.itemIds.push(product.productID);
          state.totalAmount += product.productPrice * quantity;
        }
      })
      .addCase(addToCartAsync.rejected, (state, action) => {
        console.error("Failed to add to cart:", action.payload);
      });

    // Handle removeFromCartAsync
    builder
      .addCase(removeFromCartAsync.fulfilled, (state, action) => {
        const productID = action.payload;
        const item = state.itemsById[productID];

        if (item) {
          state.totalAmount -= item.productPrice * (item.quantity || 1);
          delete state.itemsById[productID];
          state.itemIds = state.itemIds.filter((id) => id !== productID);
        }
      })
      .addCase(removeFromCartAsync.rejected, (state, action) => {
        console.error("Failed to remove from cart:", action.payload);
      });

    // Handle updateQuantityAsync
    builder
      .addCase(updateQuantityAsync.fulfilled, (state, action) => {
        const { productID, quantity } = action.payload;
        const item = state.itemsById[productID];

        if (item) {
          const oldQuantity = item.quantity || 1;
          item.quantity = quantity;
          state.totalAmount += (quantity - oldQuantity) * item.productPrice;
        }
      })
      .addCase(updateQuantityAsync.rejected, (state, action) => {
        console.error("Failed to update quantity:", action.payload);
      });

    // Handle fetchCartAsync
    builder
      .addCase(fetchCartAsync.fulfilled, (state, action) => {
        state.itemsById = {};
        state.itemIds = [];
        state.totalAmount = 0;

        action.payload.forEach((item: cartProduct) => {
          state.itemsById[item.productID] = item;
          state.itemIds.push(item.productID);
          state.totalAmount += item.productPrice * (item.quantity || 1);
        });
      })
      .addCase(fetchCartAsync.rejected, (state, action) => {
        console.error("Failed to fetch cart:", action.payload);
      });
  },
});

// Selector should accept RootState, not cartState
export const selectCartTotalAmount = (state: { cart: cartState }) =>
  state.cart.totalAmount;
export const { addToCart, removeFromCart, updateQuantity, clearCart, setCart } =
  cartSlice.actions;
export default cartSlice.reducer;
