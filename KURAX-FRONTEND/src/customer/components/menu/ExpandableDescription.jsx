import { useEffect, useRef, useState } from "react";

export default function ExpandableDescription({
  description,
  fallback,
  className = "",
  buttonClassName = "",
  moreBackgroundClassName = "",
}) {
  const paragraphRef = useRef(null);
  const measurementRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const content = description || fallback;

  useEffect(() => {
    const paragraph = paragraphRef.current;
    const measurement = measurementRef.current;
    if (!paragraph || !measurement) return undefined;

    const measureOverflow = () => {
      if (expanded) return;
      const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight);
      const twoLineHeight = Number.isFinite(lineHeight) ? lineHeight * 2 : paragraph.clientHeight;
      const visibleHeight = Math.max(paragraph.clientHeight, twoLineHeight);
      setCanExpand(measurement.getBoundingClientRect().height > visibleHeight + 1);
    };

    measureOverflow();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverflow);
      return () => window.removeEventListener("resize", measureOverflow);
    }

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(paragraph);
    observer.observe(measurement);
    return () => observer.disconnect();
  }, [content, expanded]);

  return (
    <div className="relative">
      <p
        ref={paragraphRef}
        className={`${className} ${expanded ? "whitespace-pre-line" : "line-clamp-2"} ${canExpand && !expanded ? "pr-12" : ""}`}
      >
        {content}
        {canExpand && expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-expanded="true"
            className={`ml-1 inline min-h-0 min-w-0 ${buttonClassName}`}
          >
            Less
          </button>
        )}
      </p>
      <p
          ref={measurementRef}
          aria-hidden="true"
          className={`${className} invisible pointer-events-none absolute left-0 top-0 block w-full whitespace-normal`}
      >
          {content}
      </p>
      {canExpand && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded="false"
          className={`absolute bottom-0 right-0 min-h-0 min-w-0 px-1 ${moreBackgroundClassName} ${buttonClassName}`}
        >
          More
        </button>
      )}
    </div>
  );
}
