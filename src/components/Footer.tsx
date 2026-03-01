import React from "react";

export default function Footer() {
  return (
    <footer className="py-6 bg-background/50 backdrop-blur-sm">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
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
