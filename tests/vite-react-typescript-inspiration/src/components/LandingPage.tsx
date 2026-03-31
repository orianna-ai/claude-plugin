import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Grid, Text, TextArea } from "@radix-ui/themes";
import { v4 as uuidv4 } from "uuid";

import { ArrowRightIcon, ImageIcon, PlusIcon, XIcon } from "../icons.tsx";
import type { UserMessage } from "../api.ts";

import "./LandingPage.css";

export function LandingPage({
  sendMessage,
}: {
  sendMessage: (message: UserMessage) => void;
}) {
  const [text, setText] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUploads = useCallback(async (files: FileList | File[]) => {
    const uploadedImages = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
    );

    setImageUrls((prev) => [...prev, ...uploadedImages]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUploads(e.dataTransfer.files);
      }
    },
    [handleFileUploads],
  );

  const onPaste = useCallback(
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

  const onSubmit = useCallback(() => {
    sendMessage({
      id: uuidv4().toString(),
      type: "user_message",
      text,
      image_urls: imageUrls,
    });
  }, [sendMessage, text, imageUrls]);

  const submitExample = useCallback(
    (exampleText: string) => {
      sendMessage({
        id: uuidv4().toString(),
        type: "user_message",
        text: exampleText,
        image_urls: [],
      });
    },
    [sendMessage],
  );

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize(textAreaRef.current);
  }, [text, autoResize]);

  return (
    <Box
      className="landing-page"
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      <div className="landing-page-header" />
      <div className="landing-page-grid">
        <div className="landing-page-centered-content">
          <h1 className="landing-page-title">
            Inspiration from <em>unexpected</em> places
          </h1>
          <Box className="landing-page-form">
            <Flex direction="column" gap="5">
              <TextArea
                className="landing-page-text rt-TextAreaRoot"
                placeholder="Describe your design problem"
                rows={6}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  autoResize(textAreaRef.current);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                onPaste={onPaste}
                style={{ overflow: "hidden" }}
                ref={textAreaRef}
              />
              <div
                className={`landing-page-dropzone ${dragOver ? "drag-over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    fileInputRef.current?.click();
                }}
              >
                {imageUrls.length > 0 ? (
                  <div className="landing-page-dropzone-grid">
                    <div
                      className="landing-page-plus-tile"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      role="button"
                      aria-label="add more"
                    >
                      <PlusIcon size={22} />
                    </div>
                    {imageUrls.map((src, i) => (
                      <div key={i} className="landing-page-thumb-inzone-wrap">
                        <img
                          src={src}
                          alt={`uploaded-${i}`}
                          className="landing-page-thumb-inzone"
                        />
                        <button
                          type="button"
                          className="landing-page-remove-inzone"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageUrls((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            );
                          }}
                          aria-label="Remove Image"
                        >
                          <XIcon size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="landing-page-dropzone-icon">
                      <ImageIcon size={18} />
                    </div>
                    <Text className="landing-page-caption">
                      Add screenshots of your designs
                    </Text>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) =>
                  e.target.files && handleFileUploads(e.target.files)
                }
              />
              <Flex justify="end">
                <Button
                  size="3"
                  className="landing-page-cta"
                  disabled={!(text.length > 0 || imageUrls.length > 0)}
                  onClick={onSubmit}
                >
                  <Text size="2" weight="bold">
                    Find inspiration
                  </Text>
                  <ArrowRightIcon size={18} />
                </Button>
              </Flex>
            </Flex>
          </Box>
        </div>

        <Box className="landing-page-examples">
          <Text size="2" className="landing-page-examples-label">
            Examples
          </Text>
          <Grid columns="3" gap="2" className="landing-page-examples-grid">
            <Box
              className="landing-page-example-card"
              onClick={() =>
                submitExample(
                  "I'm designing the 'Send Coach' tab in our email platform. 'Subject Line Suggestions' and 'Best Send Time' stay hidden until the account has 5 sent campaigns, but 'Spam-Risk Check' runs from day one.",
                )
              }
            >
              <div className="landing-page-example-title">Pre-5 Campaigns</div>
              <div className="landing-page-example-body">
                "I'm designing the 'Send Coach' tab in our email platform.
                'Subject Line Suggestions' and 'Best Send Time' stay hidden
                until the account has 5 sent campaigns, but 'Spam-Risk Check'
                runs from day one."
              </div>
            </Box>
            <Box
              className="landing-page-example-card"
              onClick={() =>
                submitExample(
                  "I'm stuck on a payment reconciliation dashboard. We match incoming wires to open invoices and show a 'Suggested Match' with confidence + rationale, but users often miss it in a dense table.",
                )
              }
            >
              <div className="landing-page-example-title">Threshold Nudge</div>
              <div className="landing-page-example-body">
                "I'm stuck on a payment reconciliation dashboard. We match
                incoming wires to open invoices and show a 'Suggested Match'
                with confidence + rationale, but users often miss it in a dense
                table."
              </div>
            </Box>
            <Box
              className="landing-page-example-card"
              onClick={() =>
                submitExample(
                  "On a fitness coach home page, I need to visualize the next 7 days of client workouts in a compact summary card. How can I encode both per-day volume and type mix without overwhelming the layout?",
                )
              }
            >
              <div className="landing-page-example-title">Coach Onboarding</div>
              <div className="landing-page-example-body">
                "On a fitness coach home page, I need to visualize the next 7
                days of client workouts in a compact summary card. How can I
                encode both per-day volume and type mix without overwhelming the
                layout?"
              </div>
            </Box>
          </Grid>
        </Box>
      </div>
    </Box>
  );
}
