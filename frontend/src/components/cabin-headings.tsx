"use client";

import { useEffect } from "react";

// Reveal the actual typeset graphemes, including where a title wraps at the
// current width. The editable text and its accessible name stay intact.
function revealHeading(heading: HTMLElement) {
  const bounds = heading.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const boxes: DOMRect[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent ?? "";
    for (const { segment, index } of segmenter.segment(text)) {
      if (!segment.trim()) continue;
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const box = range.getBoundingClientRect();
      if (box.width && box.height) boxes.push(box);
    }
  }
  if (!boxes.length) return;
  const rtl = getComputedStyle(heading).direction === "rtl";
  const edge = rtl ? bounds.width + 6 : -6;
  const far = rtl ? -6 : bounds.width + 6;
  const frames: Keyframe[] = [
    { clipPath: "inset(0 100% 0 0)", easing: "steps(1, end)" },
  ];
  let previous = boxes[0];
  let lineTop = -6;
  for (const box of boxes) {
    if (box.top > previous.top + previous.height * 0.5) {
      lineTop = (box.top + previous.bottom) / 2 - bounds.top;
    }
    const end = (rtl ? box.left : box.right) - bounds.left;
    const bottom = box.bottom - bounds.top + 2;
    frames.push({
      clipPath: `polygon(${edge}px -6px,${far}px -6px,${far}px ${lineTop}px,${end}px ${lineTop}px,${end}px ${bottom}px,${edge}px ${bottom}px)`,
      easing: "steps(1, end)",
    });
    previous = box;
  }
  const duration = heading.classList.contains("typed")
    ? 576
    : Math.min(720, 66 + boxes.length * 16);
  heading.style.setProperty("--title-reveal-time", duration + "ms");
  return heading.animate(frames, { duration });
}

export function CabinHeadings({
  path,
  reduced,
}: {
  path: string;
  reduced: boolean;
}) {
  useEffect(() => {
    const content = document.getElementById("page-content");
    if (
      !content ||
      reduced ||
      document.documentElement.dataset.motion === "reduced" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof Intl.Segmenter !== "function"
    )
      return;
    let current: HTMLElement | null = null;
    let text: string | null = null;
    let animation: Animation | undefined;
    function check() {
      const heading = content?.querySelector<HTMLElement>("main h1");
      if (!heading || heading.classList.contains("arrival-word")) return;
      if (heading === current && heading.textContent === text) return;
      current = heading;
      text = heading.textContent;
      animation?.cancel();
      animation = revealHeading(heading);
    }
    check();
    // Titles from server data can replace loading content after navigation.
    const observer = new MutationObserver(check);
    observer.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [path, reduced]);
  return null;
}
