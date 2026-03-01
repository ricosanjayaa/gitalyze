import React from "react";

export default function Footer() {
  return (
    <footer className="mt-auto py-6 bg-background/70 backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] text-muted-foreground/90 font-mono">
        <span className="font-sans">
          Copyright © {new Date().getFullYear()} {" "}
          <a
            href="https://github.com/ricosanjayaa"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline transition-colors font-sans"
          >
            Rico Sanjaya
          </a>
        </span>
        <span className="font-sans">
          Open source on{" "}
          <a
            href="https://github.com/ricosanjayaa/gitalyze"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline transition-colors font-sans"
          >
            GitHub
          </a>
        </span>
      </div>
    </footer>
  );
}
