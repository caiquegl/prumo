"use client";

import { useEffect, useRef } from "react";

export function ScrollDevice() {
  const deviceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const device = deviceRef.current;
    const stage = stageRef.current;
    if (!device || !stage) return;

    let frame = 0;

    const update = () => {
      const rect = stage.getBoundingClientRect();
      const viewH = window.innerHeight || 1;
      const start = viewH * 0.85;
      const end = -rect.height * 0.2;
      const raw = (start - rect.top) / (start - end);
      const p = Math.min(1, Math.max(0, raw));
      const rotateY = -28 + p * 56;
      const rotateX = 12 - p * 22;
      const translateY = (0.5 - p) * 40;
      device.style.transform = `translate3d(0, ${translateY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={stageRef} className="device-stage flex justify-center py-8 md:py-4">
      <div ref={deviceRef} className="device">
        <div className="device-shell">
          <div className="device-screen">
            <div className="device-screen-grid" />
            <div className="absolute inset-x-5 top-10 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                Prumo Web
              </p>
              <p className="display text-[1.55rem] text-[color:var(--ink)]">
                Sites que
                <br />
                convertem.
              </p>
              <div className="mt-6 h-24 rounded-2xl bg-[color:var(--ink)]/90 p-4 text-[#f7f2ea]">
                <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                  Performance
                </p>
                <p className="mt-2 text-sm leading-snug">
                  Scroll, microinterações e carga rápida — sem excesso.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
