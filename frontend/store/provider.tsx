"use client";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { fetchCartAsync } from "./cartSlice";
import { fetchWishlistAsync } from "./wishListSlice";
import store from "./index";

export default function ReduxProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Hydrate the Redux cart and wishlist state from the database when the app loads
  useEffect(() => {
    store.dispatch(fetchCartAsync());
    store.dispatch(fetchWishlistAsync());
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
