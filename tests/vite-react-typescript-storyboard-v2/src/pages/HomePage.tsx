import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Flex, Text, TextArea } from "@radix-ui/themes";

import { AlertCircleIcon } from "../icons.tsx";
import { ArrowRightIcon } from "../icons.tsx";
import { ImageIcon } from "../icons.tsx";
import { Loader2Icon } from "../icons.tsx";
import { PlusIcon } from "../icons.tsx";
import { XIcon } from "../icons.tsx";
import { DRIVE_CLIENT } from "../drive.ts";
import type { ImageContent, TextContent } from "../api/types.gen.ts";
import DesignPicker from "../components/design-picker/DesignPicker";
import ImageModal from "../components/image-modal/ImageModal";
import PaywallModal from "../components/paywall-modal/PaywallModal";
import { useDesigns } from "../hooks/useDesigns";
import { usePaywall } from "../hooks/usePaywall";

import "./HomePage.css";

/**
 * Reads text and image URLs from query params to restore form state after Stripe redirect.
 * Returns the restored values and cleans up the URL.
 */
function useRestoredFormState(): {
  restoredText: string;
  restoredImages: ImageContent[];
} {
  const [restoredText, setRestoredText] = useState("");
  const [restoredImages, setRestoredImages] = useState<ImageContent[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const textParam = params.get("text");
    const imagesParam = params.get("images");

    let hasParams = false;

    if (textParam) {
      setRestoredText(textParam);
      hasParams = true;
    }

    if (imagesParam) {
      try {
        const parsed = JSON.parse(imagesParam);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) => typeof item === "string" && item.startsWith("http"),
          )
        ) {
          setRestoredImages(
            parsed.map((url) => ({ type: "image", url }) as ImageContent),
          );
        }
      } catch {
        // Invalid JSON, ignore
      }
      hasParams = true;
    }

    if (hasParams) {
      const url = new URL(window.location.href);
      url.searchParams.delete("text");
      url.searchParams.delete("images");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  return { restoredText, restoredImages };
}

function HomePage() {
  const { restoredText, restoredImages } = useRestoredFormState();

  const [text, setText] = useState<TextContent>({ type: "text", text: "" });

  const [images, setImages] = useState<ImageContent[]>([]);

  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (
      !hasRestoredRef.current &&
      (restoredText || restoredImages.length > 0)
    ) {
      if (restoredText) {
        setText({ type: "text", text: restoredText });
      }
      if (restoredImages.length > 0) {
        setImages(restoredImages);
      }
      hasRestoredRef.current = true;
    }
  }, [restoredText, restoredImages]);

  const [uploadingCount, setUploadingCount] = useState(0);

  const [dragOver, setDragOver] = useState(false);

  const [imageError, setImageError] = useState(false);

  const [textError, setTextError] = useState(false);

  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const [showError, setShowError] = useState(false);
  const [isErrorExiting, setIsErrorExiting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorTimeoutRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const { createDesign, selectDesign } = useDesigns();

  const redirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "/";

    const origin = window.location.origin;
    const url = new URL(origin);

    if (text.text) {
      url.searchParams.set("text", text.text);
    }

    if (images.length > 0) {
      const imageUrls = images.map((img) => img.url);
      url.searchParams.set("images", JSON.stringify(imageUrls));
    }

    const fullUrl = url.toString();

    if (fullUrl.length > 2000) {
      return origin;
    }

    return fullUrl;
  }, [text.text, images]);

  const {
    showPaywall,
    paywallData,
    checkPaywall,
    handleUpgrade,
    closePaywall,
  } = usePaywall({
    successUrl: redirectUrl,
    cancelUrl: redirectUrl,
  });

  const handleFileUploads = useCallback(async (files: FileList | File[]) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const validFiles = Array.from(files).filter((file) =>
      allowedTypes.includes(file.type.toLowerCase()),
    );

    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingCount((prev) => prev + validFiles.length);
    setImageError(false);

    const uploadedImages = (
      await Promise.all(
        validFiles.map((file) =>
          DRIVE_CLIENT.upload(file)
            .then((url) => {
              setUploadingCount((prev) => prev - 1);
              return { type: "image", url } as ImageContent;
            })
            .catch((e) => {
              console.error(e);
              setUploadingCount((prev) => prev - 1);
              return null;
            }),
        ),
      )
    ).filter(Boolean) as ImageContent[];

    setImages((prev) => [...prev, ...uploadedImages]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUploads(e.dataTransfer.files);
      }
    },
    [handleFileUploads],
  );

  const handleTextPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.files;
      if (items && items.length > 0) {
        e.preventDefault();
        handleFileUploads(items);
      }
    },
    [handleFileUploads],
  );

  const dismissError = useCallback(() => {
    setIsErrorExiting(true);
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    window.setTimeout(() => {
      setShowError(false);
      setIsErrorExiting(false);
    }, 300);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (images.length === 0 && uploadingCount === 0) {
      setImageError(true);
    }

    if (text.text.length === 0) {
      setTextError(true);
    }

    if (images.length === 0 || text.text.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Figure out how to capture if a user runs out of quota & there is no upgrade
      const shouldShowPaywall = await checkPaywall();
      if (shouldShowPaywall) {
        setIsSubmitting(false);
        return;
      }

      const design = await createDesign({ problem: [text, ...images] });
      selectDesign(design.id);
    } catch (e) {
      console.error("Failed to create design:", e);
      setIsSubmitting(false);

      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }

      setShowError(true);
      setIsErrorExiting(false);

      errorTimeoutRef.current = window.setTimeout(() => {
        dismissError();
      }, 5000);
    }
  }, [
    text,
    images,
    uploadingCount,
    isSubmitting,
    checkPaywall,
    createDesign,
    selectDesign,
    dismissError,
  ]);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 300;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    autoResize(textAreaRef.current);
  }, [text, autoResize]);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return;
      }

      if (!e.clipboardData) return;

      const files = e.clipboardData.files;
      const text = e.clipboardData.getData("text/plain");

      if (files && files.length > 0) {
        e.preventDefault();
        handleFileUploads(files);
        return;
      }

      if (text) {
        e.preventDefault();
        setText((prev) => ({ type: "text", text: prev.text + text }));
        setTextError(false);
        textAreaRef.current?.focus();
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [handleFileUploads]);

  return (
    <Box
      className="home-page"
      onDrop={handleFileDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      <DesignPicker variant="home" />
      <div className="home-page-main">
        <div className="home-page-grid">
          <div className="home-page-centered-content">
            <h1 className="home-page-title">What problem are you solving?</h1>
            <Box className="home-page-form">
              <Flex direction="column" gap="5">
                <TextArea
                  className={`home-page-text rt-TextAreaRoot fs-unmask ${textError ? "error" : ""}`}
                  placeholder="Describe the user problem and other important details"
                  rows={6}
                  value={text.text}
                  onChange={(e) => {
                    setText({ type: "text", text: e.target.value });
                    setTextError(false);
                    autoResize(textAreaRef.current);
                  }}
                  onPaste={handleTextPaste}
                  style={{ overflow: "hidden" }}
                  ref={textAreaRef}
                />
                <div
                  className={`home-page-dropzone ${dragOver ? "drag-over" : ""} ${images.length > 0 || uploadingCount > 0 ? "has-images" : ""} ${imageError ? "error" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " ") fileInputRef.current?.click();
                  }}
                >
                  {images.length > 0 || uploadingCount > 0 ? (
                    <div className="home-page-dropzone-grid">
                      <div
                        className="home-page-plus-tile"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        role="button"
                        aria-label="add more"
                      >
                        <PlusIcon size={22} />
                      </div>
                      {images.map((image, i) => (
                        <div key={i} className="home-page-thumb-inzone-wrap">
                          <img
                            src={image.url}
                            alt={`uploaded-${i}`}
                            crossOrigin="anonymous"
                            className="home-page-thumb-inzone"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalImageUrl(image.url);
                            }}
                          />
                          <button
                            type="button"
                            className="home-page-remove-inzone"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImages((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              );
                            }}
                            aria-label="Remove Image"
                          >
                            <XIcon size={16} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                      {Array.from({ length: uploadingCount }).map((_, i) => (
                        <div
                          key={`loading-${i}`}
                          className="home-page-thumb-loading"
                        >
                          <Loader2Icon
                            size={24}
                            className="home-page-loading-spinner"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="home-page-dropzone-icon">
                        <ImageIcon size={18} />
                      </div>
                      <Text className="home-page-caption">
                        Add at least 1 screenshot of the experience
                      </Text>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) =>
                    e.target.files && handleFileUploads(e.target.files)
                  }
                />
                <Flex justify="end">
                  <Button
                    size="3"
                    className={`home-page-cta ${text.text.length > 0 && images.length > 0 ? "active" : ""}`}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <Text size="2" weight="bold">
                      Explore solutions
                    </Text>
                    <ArrowRightIcon size={18} />
                  </Button>
                </Flex>
              </Flex>
            </Box>
          </div>
        </div>
      </div>
      <ImageModal
        imageUrl={modalImageUrl}
        onClose={() => setModalImageUrl(null)}
      />
      <PaywallModal
        isOpen={showPaywall}
        onClose={closePaywall}
        onUpgrade={handleUpgrade}
        paywallData={paywallData}
      />
      {showError && (
        <div
          className={`home-page-error-toast${isErrorExiting ? " home-page-error-toast-exit" : ""}`}
          onClick={dismissError}
        >
          <AlertCircleIcon size={18} />
          <span>Something went wrong. Please try again.</span>
          <button
            type="button"
            className="home-page-error-dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismissError();
            }}
            aria-label="Dismiss"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}
    </Box>
  );
}

export default HomePage;
