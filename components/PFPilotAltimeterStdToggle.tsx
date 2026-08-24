"use client";

import { useEffect } from "react";

export default function PFPilotAltimeterStdToggle() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button");
      if (!button || button.textContent?.trim() !== "STD") return;

      const isActiveStd = button.className.includes("bg-green-400/10");
      if (!isActiveStd) return;

      const card = button.closest(".rounded-2xl");
      const input = card?.querySelector<HTMLInputElement>("input");
      if (!input) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;

      if (!nativeValueSetter) return;

      // Trigger the existing React input handler without changing the visible
      // pressure value. That handler switches isStd to false.
      nativeValueSetter.call(input, `${input.value} `);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
