"use client";

interface LinkifyProps {
  text: string;
}

export const Linkify: React.FC<LinkifyProps> = ({ text }) => {
  if (!text) {
    return <>{text}</>;
  }

  const urlRegex = /((?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g;
  
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    const url = match[0];
    const isExternal = !url.includes('github.com');
    const href = isExternal ? `/redirect?url=${encodeURIComponent(url.startsWith('http') ? url : `https://${url}`)}` : (url.startsWith('http') ? url : `//${url}`);

    parts.push(
      <a
        key={match.index}
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="text-primary hover:underline"
        onClick={(e) => {
          if (isExternal) {
            e.preventDefault();
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          e.stopPropagation();
        }}
      >
        {url}
      </a>
    );

    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts.length > 0 ? parts : text}</>;
};
