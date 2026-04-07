import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  Text,
  VisuallyHidden,
} from "@radix-ui/themes";

import { XIcon } from "../../icons.tsx";
import type { Image } from "../../api.ts";

import { ImageModalBlock } from "./ImageModalBlock.tsx";

import "./ImageGalleryBlock.css";

const figmaLogo =
  "https://drive.orianna.ai/f5028df8fb5734ca45dfc9f7c5ea42f8.svg";
const appsIcon =
  "https://drive.orianna.ai/90aaaf4e1a709b5ce1c32cbc316988e8.svg";

export function ImageGalleryBlock({ images }: { images?: Image[] }) {
  const hasImages = (images?.length ?? 0) > 0;
  const showSkeleton = !hasImages;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [activeFilters, setActiveFilters] = useState<
    Set<"figma_source" | "mobbin_source" | undefined>
  >(new Set());

  const hasFigmaResults = useMemo(() => {
    return (
      images?.some((image) => image.source.type === "figma_source") ?? false
    );
  }, [images]);

  const filteredImages = useMemo(() => {
    if (!images) return [];
    if (activeFilters.size === 0) return images;
    return images.filter((image) => activeFilters.has(image.source.type));
  }, [activeFilters, images]);

  const selectedFilteredImage =
    selectedImageIndex != null ? filteredImages?.[selectedImageIndex] : null;

  const selectedImage = useMemo(() => {
    if (!selectedFilteredImage || !images) return null;
    return images.find((img) => img === selectedFilteredImage) || null;
  }, [selectedFilteredImage, images]);

  useEffect(() => {
    setSelectedImageIndex(null);
    setModalOpen(false);
  }, [activeFilters]);

  if (hasImages) {
    return (
      <div className="image-gallery-block">
        {hasFigmaResults && (
          <div className="image-gallery-block-filter">
            <Button
              variant="solid"
              radius="full"
              size="2"
              className={`image-gallery-block-filter-button image-gallery-block-filter-button-figma ${
                activeFilters.has("figma_source")
                  ? "image-gallery-block-filter-button-active"
                  : ""
              }`}
              onClick={() => {
                setActiveFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has("figma_source")) {
                    next.delete("figma_source");
                  } else {
                    next.add("figma_source");
                  }
                  return next;
                });
              }}
            >
              <img
                src={figmaLogo}
                alt="Figma"
                className="image-gallery-block-filter-button-logo"
              />
              Figma
            </Button>
            <Button
              variant="solid"
              radius="full"
              size="2"
              className={`image-gallery-block-filter-button image-gallery-block-filter-button-apps ${
                activeFilters.has("mobbin_source")
                  ? "image-gallery-block-filter-button-active"
                  : ""
              }`}
              onClick={() => {
                setActiveFilters((prev) => {
                  const next = new Set(prev);
                  if (next.has("mobbin_source")) {
                    next.delete("mobbin_source");
                  } else {
                    next.add("mobbin_source");
                  }
                  return next;
                });
              }}
            >
              <img
                src={appsIcon}
                alt="Apps"
                className="image-gallery-block-filter-button-logo"
              />
              Apps
            </Button>
          </div>
        )}
        <Grid columns="2" gap="4" className="image-gallery-block-grid">
          {filteredImages.map((image, idx) => (
            <Box
              key={idx}
              className="image-gallery-block-card"
              onClick={() => {
                setSelectedImageIndex(idx);
                setModalOpen(true);
              }}
            >
              <img
                className="image-gallery-block-image"
                src={image.url}
                alt={image.title}
              />
              <div className="image-gallery-block-caption">
                <Flex align="start" gap="2">
                  {image.source.type === "figma_source" && (
                    <img
                      src={figmaLogo}
                      alt="Figma"
                      className="image-gallery-block-figma-logo"
                    />
                  )}
                  <div>
                    <Text
                      as="div"
                      size="1"
                      className="image-gallery-block-caption-title"
                    >
                      {image.title}
                    </Text>
                    <Text size="1" className="image-gallery-block-caption-text">
                      {image.caption}
                    </Text>
                  </div>
                </Flex>
              </div>
            </Box>
          ))}
        </Grid>
        {selectedImage && (
          <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
            <Dialog.Content
              maxWidth={
                selectedImage.source.type === "figma_source"
                  ? "100%"
                  : "fit-content"
              }
              className={
                selectedImage.source.type === "figma_source"
                  ? "image-gallery-block-modal-figma-source"
                  : "image-gallery-block-modal "
              }
            >
              <VisuallyHidden>
                <Dialog.Title>{selectedImage.title}</Dialog.Title>
                <Dialog.Description>{selectedImage.caption}</Dialog.Description>
              </VisuallyHidden>
              {selectedImage.source.type === "figma_source" && (
                <Button
                  variant="solid"
                  radius="full"
                  size="2"
                  className="image-gallery-block-modal-close"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close dialog"
                >
                  <XIcon size={16} strokeWidth={2} />
                </Button>
              )}
              <ImageModalBlock image={selectedImage} />
            </Dialog.Content>
          </Dialog.Root>
        )}
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className="image-gallery-block">
        <Grid columns="2" gap="4" className="image-gallery-block-grid">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Box key={idx} className="image-gallery-block-card">
              <div className="image-gallery-block-image" />
              <Flex
                direction="column"
                gap="2"
                className="image-gallery-block-caption"
              >
                <div className="image-gallery-block-skel-pill" />
                <div className="image-gallery-block-skel-line" />
                <div className="image-gallery-block-skel-line" />
              </Flex>
            </Box>
          ))}
        </Grid>
        <div className="image-gallery-block-footer">
          <Text className="image-gallery-block-footer-shimmer" weight="bold">
            Finding inspiration
          </Text>
          <Text className="image-gallery-block-footer-time" weight="regular">
            1-3 min
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="image-gallery-block">
      <div className="image-gallery-block-footer">
        <Text className="image-gallery-block-footer-shimmer" weight="bold">
          Finding inspiration
        </Text>
        <Text className="image-gallery-block-footer-time" weight="regular">
          1-3 min
        </Text>
      </div>
    </div>
  );
}
