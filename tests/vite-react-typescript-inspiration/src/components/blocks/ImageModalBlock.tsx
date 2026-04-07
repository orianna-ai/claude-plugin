import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  type Node,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useUpdateNodeInternals,
} from "reactflow";
import { Box, Flex, Text } from "@radix-ui/themes";

import { Loader2Icon } from "../../icons.tsx";
import type { FigmaSource, Image, MobbinSource } from "../../api.ts";

import "./ImageModalBlock.css";

export function ImageModalBlock({ image }: { image: Image }) {
  return (
    <>
      <ImageViewer image={image} />
      <ImageCaption image={image} />
    </>
  );
}

function ImageViewer({ image }: { image: Image }) {
  switch (image.source.type) {
    case "figma_source":
      return <FigmaImageViewer source={image.source} />;
    case "mobbin_source":
      return <MobbinImageViewer source={image.source} />;
  }
}

function FigmaImageViewer({ source }: { source: FigmaSource }) {
  const [styles, setStyles] = useState("");
  const [html, setHtml] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingComplete = false;

    const spinnerTimeout = window.setTimeout(() => {
      if (!cancelled && !loadingComplete) {
        setShowSpinner(true);
      }
    }, 500);

    async function fetchTileLayout() {
      setShowSpinner(false);

      try {
        const response = await fetch(source.result.page_html_url);

        const parser = new DOMParser();

        const document = parser.parseFromString(
          await response.text(),
          "text/html",
        );

        if (!cancelled) {
          loadingComplete = true;
          setStyles(
            Array.from(document.head.querySelectorAll("style"))
              .map((style) => style.textContent)
              .join("\n"),
          );

          setHtml(document.body.innerHTML);
          setShowSpinner(false);
        }
      } catch (error) {
        console.error("Failed to fetch Figma tile:", error);
      }
    }

    fetchTileLayout();

    return () => {
      cancelled = true;
      clearTimeout(spinnerTimeout);
      setShowSpinner(false);
    };
  }, [source.result.page_html_url]);

  return (
    <div className="image-modal-block-figma">
      <ReactFlowProvider>
        <FigmaImageViewerCanvas
          styles={styles}
          html={html}
          source={source}
          showSpinner={showSpinner}
        />
      </ReactFlowProvider>
    </div>
  );
}

function FigmaImageViewerCanvas({
  styles,
  html,
  source,
  showSpinner,
}: {
  styles: string;
  html: string;
  source: FigmaSource;
  showSpinner: boolean;
}) {
  const reactFlow = useReactFlow();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesInitialized = useNodesInitialized();
  const hasScrolledRef = useRef(false);

  const nodes: Node[] = useMemo(() => {
    if (!html) {
      return [];
    } else {
      return [
        {
          id: source.tile.tile_id,
          position: { x: 0, y: 0 },
          type: "FigmaImageViewerNode",
          data: { html },
          draggable: false,
          selectable: false,
        },
      ];
    }
  }, [html, source.tile.tile_id]);

  useEffect(() => {
    if (
      !html ||
      !nodesInitialized ||
      !containerRef.current ||
      hasScrolledRef.current
    )
      return;

    const container = containerRef.current;

    const containerWidth = container?.clientWidth ?? 0;

    const containerHeight = container?.clientHeight ?? 0;

    const zoomX =
      containerWidth > 0 ? containerWidth / source.tile.tile_width : 1;

    const zoomY =
      containerHeight > 0 ? containerHeight / source.tile.tile_height : 1;

    const zoom = Math.min(zoomX, zoomY);

    const centerX = source.tile.tile_absolute_x + source.tile.tile_width / 2;

    const centerY = source.tile.tile_absolute_y + source.tile.tile_height / 2;

    reactFlow.setCenter(centerX, centerY, { zoom });

    hasScrolledRef.current = true;
  }, [
    html,
    nodesInitialized,
    reactFlow,
    source.tile.tile_absolute_x,
    source.tile.tile_absolute_y,
    source.tile.tile_width,
    source.tile.tile_height,
  ]);

  return (
    <Box
      ref={containerRef}
      style={{ width: "100%", height: "80vh", position: "relative" }}
    >
      {styles ? <style dangerouslySetInnerHTML={{ __html: styles }} /> : null}
      {showSpinner && (
        <div className="image-modal-block-figma-spinner">
          <Loader2Icon className="image-modal-block-figma-spinner-icon" />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        nodeTypes={{ FigmaImageViewerNode: FigmaImageViewerNode }}
        panOnDrag
        panOnScroll
        panOnScrollSpeed={2.0}
        zoomOnScroll={false}
        zoomOnPinch
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        minZoom={0.25}
        maxZoom={16}
        proOptions={{ hideAttribution: true }}
        style={{ width: "100%", height: "100%", backgroundColor: "#E5E0DB" }}
      />
    </Box>
  );
}

function FigmaImageViewerNode({ id, data }: NodeProps<{ html: string }>) {
  const updateNodeInternals = useUpdateNodeInternals();

  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const element = containerRef.current;

      if (element) {
        const width = Math.ceil(
          element.scrollWidth || element.offsetWidth || 0,
        );

        const height = Math.ceil(
          element.scrollHeight || element.offsetHeight || 0,
        );

        if (width > 0 && height > 0) {
          setSize({ width, height });
        }

        updateNodeInternals(id);
      }
    });

    return () => cancelAnimationFrame(handle);
  }, [id, data.html, updateNodeInternals]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "inline-block",
        position: "relative",
        width: size ? `${size.width}px` : undefined,
        height: size ? `${size.height}px` : undefined,
      }}
    >
      <div
        className="image-modal-block-figma-html"
        style={{
          transformOrigin: "top left",
          pointerEvents: "auto",
          display: "inline-block",
          position: "relative",
        }}
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </div>
  );
}

function MobbinImageViewer({ source }: { source: MobbinSource }) {
  return (
    <div className="image-modal-block-mobbin">
      <img
        className="image-modal-block-image"
        src={source.result.screen_url}
        alt={source.result.app_name}
      />
    </div>
  );
}

function ImageCaption({ image }: { image: Image }) {
  switch (image.source.type) {
    case "figma_source":
      return <FigmaImageCaption image={image} />;
    case "mobbin_source":
      return <MobbinImageCaption image={image} />;
  }
}

function FigmaImageCaption({ image }: { image: Image }) {
  return (
    <div className="image-modal-block-caption">
      <Flex align="start" gap="2" style={{ marginBottom: "20px" }}>
        <img
          src={"https://drive.orianna.ai/f5028df8fb5734ca45dfc9f7c5ea42f8.svg"}
          alt="Figma"
          className="image-modal-block-figma-logo"
        />
        <Text as="div" className="image-modal-block-caption-title">
          {image.title}
          {(image.source as FigmaSource).result.page_name &&
          (image.source as FigmaSource).result.page_url ? (
            <>
              {" / "}
              <a
                href={(image.source as FigmaSource).result.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="image-modal-block-page-link"
                title={(image.source as FigmaSource).result.page_name}
              >
                {(image.source as FigmaSource).result.page_name}
              </a>
            </>
          ) : null}
        </Text>
      </Flex>
      <div className="image-modal-block-caption-grid">
        {Object.entries(image.labels || {}).map(([label, value], i) => (
          <Fragment key={`${label}-${i}`}>
            <Text>{label}</Text>
            <Text>{value}</Text>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function MobbinImageCaption({ image }: { image: Image }) {
  return (
    <div className="image-modal-block-caption-mobbin">
      <Text as="div" className="image-modal-block-caption-title">
        {image.title}
      </Text>
      <div className="image-modal-block-caption-grid">
        {Object.entries(image.labels || {}).map(([label, value], i) => (
          <Fragment key={`${label}-${i}`}>
            <Text>{label}</Text>
            <Text>{value}</Text>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
