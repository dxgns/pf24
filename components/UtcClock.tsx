"use client";

import { useEffect, useState } from "react";

export default function UtcClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <>{now.toISOString().slice(11, 19)}Z</>;
}