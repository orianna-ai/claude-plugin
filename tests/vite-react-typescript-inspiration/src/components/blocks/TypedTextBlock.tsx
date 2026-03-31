import { useCallback, useEffect, useRef } from "react";
import Typewriter, { type TypewriterClass } from "typewriter-effect";

export function TypedTextBlock({ text }: { text: string }) {
  const typewriterRef = useRef<TypewriterClass | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const typeText = useCallback((delta: string) => {
    if (!typewriterRef.current || delta.length === 0) {
      return;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    let position = 0;

    const computeSpeed = (length: number): number => {
      if (length > 1200) return 24;
      if (length > 600) return 8;
      return 4;
    };

    const typeNextChunk = () => {
      const remaining = delta.length - position;
      const speed = computeSpeed(remaining);
      const chunk = delta.slice(position, position + speed);
      typewriterRef.current?.pasteString(chunk, null).start();
      position += speed;

      if (position < delta.length) {
        animationFrameRef.current = requestAnimationFrame(typeNextChunk);
      }
    };

    typeNextChunk();
  }, []);

  useEffect(() => {
    if (!typewriterRef.current) {
      return;
    }

    typeText(text);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [text, typeText]);

  return (
    <Typewriter
      options={{
        delay: 0,
        cursor: "",
      }}
      onInit={(typewriter) => {
        typewriterRef.current = typewriter;
        typeText(text);
      }}
    />
  );
}
