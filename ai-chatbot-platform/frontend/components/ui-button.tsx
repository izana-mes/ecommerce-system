"use client";

import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export function UIButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-md bg-accent px-3 py-2 text-sm font-medium text-black transition hover:brightness-110 disabled:opacity-50",
        props.className
      )}
    />
  );
}
