"use client";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { clearCart, fetchCartAsync } from "./cartSlice";
import { clearWishList, fetchWishlistAsync } from "./wishListSlice";
import store from "./index";
import { getUser, subscribeToAuthChanges } from "@/lib/auth";

type AbortableRequest = { abort: () => void };

export default function ReduxProvider({
  children}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    let loadedCustomer: string | null = null;
    let cartRequest: AbortableRequest | null = null;
    let wishlistRequest: AbortableRequest | null = null;

    const cancelRequests = () => {
      cartRequest?.abort();
      wishlistRequest?.abort();
      cartRequest = null;
      wishlistRequest = null;
    };

    const syncCustomerStore = () => {
      const user = getUser();
      const customerKey = user?.role === "user" ? String(user.id ?? user.email) : null;
      if (customerKey === loadedCustomer) return;

      cancelRequests();
      store.dispatch(clearCart());
      store.dispatch(clearWishList());
      loadedCustomer = customerKey;

      if (customerKey) {
        cartRequest = store.dispatch(fetchCartAsync());
        wishlistRequest = store.dispatch(fetchWishlistAsync());
      }
    };

    syncCustomerStore();
    const unsubscribe = subscribeToAuthChanges(syncCustomerStore);
    return () => {
      unsubscribe();
      cancelRequests();
      store.dispatch(clearCart());
      store.dispatch(clearWishList());
    };
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
