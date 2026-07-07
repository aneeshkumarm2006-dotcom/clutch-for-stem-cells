"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Unlink,
  ImagePlus,
  Undo2,
  Redo2,
  Strikethrough,
  Code2,
  Loader2,
  Upload,
  Images,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { uploadBlogImage } from "@/components/seoteam/image-field";
import { MediaPickerDialog } from "@/components/seoteam/media-picker-dialog";

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-alt disabled:opacity-40",
        active && "bg-tint text-azure-700",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

/**
 * Tiptap WYSIWYG editor for blog bodies. Outputs HTML (sanitized server-side on
 * save). Supports a raw-HTML source view (`<>`), link/image insertion via small
 * dialogs, and inline image upload (drag, paste, or the image dialog → Cloudinary).
 *
 * Prop contract `{ value, onChange, placeholder }` is intentionally stable — this
 * component is shared with the combination-page editor (matrix-editor.tsx).
 *
 * HTML source mode: the `<textarea>` is the source of truth; its raw value flows
 * straight to `onChange` so tags Tiptap can't model round-trip untouched. On the
 * way back to visual mode we `setContent(value, false)` (emitUpdate=false) so we
 * never re-emit the normalized `getHTML()` and clobber that raw value. Tiptap
 * still drops nodes outside its schema when it renders visual mode, so hand-written
 * HTML is best finished in the source view.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your post…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = React.useRef<Editor | null>(null);
  const dialogFileRef = React.useRef<HTMLInputElement>(null);

  const [mode, setMode] = React.useState<"visual" | "html">("visual");

  // Link dialog
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");

  // Image dialog. `imgMode` distinguishes inserting a new image from editing one
  // that's already in the body; `imgPos` is the document position of the node
  // being edited so we can target it with updateAttributes.
  const [imageOpen, setImageOpen] = React.useState(false);
  const [imgMode, setImgMode] = React.useState<"insert" | "edit">("insert");
  const [imgPos, setImgPos] = React.useState<number | null>(null);
  const [imgSrc, setImgSrc] = React.useState("");
  const [imgAlt, setImgAlt] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);

  const insertImageFile = React.useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const { url } = await uploadBlogImage(file);
      editor.chain().focus().setImage({ src: url }).run();
      // Drag/paste images arrive with no alt — locate the node we just inserted
      // and open the dialog focused on its alt field so it can be added right
      // away. Non-blocking: the image is already in the body; skipping the
      // dialog just leaves it without alt (editable later by clicking it).
      let pos: number | null = null;
      editor.state.doc.descendants((node, nodePos) => {
        if (node.type.name === "image" && node.attrs.src === url) pos = nodePos;
      });
      if (pos != null) {
        setImgMode("edit");
        setImgPos(pos);
        setImgSrc(url);
        setImgAlt("");
        setImageOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image upload failed.");
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener", target: "_blank" },
      }),
      ImageExt.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose-blog min-h-[360px] max-w-none px-4 py-3 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const image = files.find((f) => f.type.startsWith("image/"));
        if (image) {
          void insertImageFile(image);
          return true;
        }
        return false; // let ProseMirror clean up normal (Docs/Word) paste
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const files = Array.from(dt?.files ?? []);
        const image = files.find((f) => f.type.startsWith("image/"));
        if (image) {
          event.preventDefault();
          void insertImageFile(image);
          return true;
        }
        return false;
      },
      // Click an existing image to edit it — opens the dialog pre-filled with its
      // src/alt so alt text can be added or fixed after insertion (including on
      // drag/pasted images, which arrive with no alt).
      handleClickOn: (_view, _pos, node, nodePos, _event, direct) => {
        if (!direct || node.type.name !== "image") return false;
        setImgMode("edit");
        setImgPos(nodePos);
        setImgSrc((node.attrs.src as string | null) ?? "");
        setImgAlt((node.attrs.alt as string | null) ?? "");
        setImageOpen(true);
        editorRef.current?.chain().setNodeSelection(nodePos).run();
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  editorRef.current = editor;

  // ── HTML source toggle ──────────────────────────────────────────────────────
  const toggleMode = React.useCallback(() => {
    if (mode === "html") {
      // Returning to visual: load the raw HTML WITHOUT emitting an update, so the
      // form keeps the raw value (nodes Tiptap can't model aren't lost from state).
      editor?.commands.setContent(value, false);
      setMode("visual");
    } else {
      setMode("html");
    }
  }, [mode, editor, value]);

  // ── Link dialog ─────────────────────────────────────────────────────────────
  const openLinkDialog = React.useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previous ?? "https://");
    setLinkOpen(true);
  }, [editor]);

  const applyLink = React.useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkOpen(false);
  }, [editor, linkUrl]);

  const removeLink = React.useCallback(() => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  // ── Image dialog ────────────────────────────────────────────────────────────
  const openImageDialog = React.useCallback(() => {
    setImgMode("insert");
    setImgPos(null);
    setImgSrc("");
    setImgAlt("");
    setImageOpen(true);
  }, []);

  const handleDialogUpload = React.useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const { url } = await uploadBlogImage(file);
      setImgSrc(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  const insertImage = React.useCallback(() => {
    if (!editor) return;
    const src = imgSrc.trim();
    if (!/^https?:\/\//i.test(src)) {
      toast.error("Upload an image or paste a valid http(s) URL.");
      return;
    }
    const alt = imgAlt.trim();
    if (imgMode === "edit" && imgPos != null) {
      // Update the clicked image in place. Empty alt is stored as null so the
      // rendered <img> carries no alt attribute rather than alt="".
      editor
        .chain()
        .focus()
        .setNodeSelection(imgPos)
        .updateAttributes("image", { src, alt: alt || null })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setImage({ src, alt: alt || undefined })
        .run();
    }
    setImageOpen(false);
  }, [editor, imgSrc, imgAlt, imgMode, imgPos]);

  if (!editor) {
    return (
      <div className="min-h-[420px] rounded-lg border border-border bg-surface" />
    );
  }

  const fmtDisabled = mode === "html";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-alt/60 px-2 py-1.5">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          active={editor.isActive("bold")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          active={editor.isActive("italic")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={UnderlineIcon}
          label="Underline"
          active={editor.isActive("underline")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Strikethrough"
          active={editor.isActive("strike")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Divider />
        <ToolbarButton
          icon={Heading2}
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          disabled={fmtDisabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          icon={Heading3}
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          disabled={fmtDisabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <Divider />
        <ToolbarButton
          icon={List}
          label="Bullet list"
          active={editor.isActive("bulletList")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered list"
          active={editor.isActive("orderedList")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={Quote}
          label="Quote"
          active={editor.isActive("blockquote")}
          disabled={fmtDisabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <Divider />
        <ToolbarButton
          icon={Link2}
          label="Add link"
          active={editor.isActive("link")}
          disabled={fmtDisabled}
          onClick={openLinkDialog}
        />
        <ToolbarButton
          icon={Unlink}
          label="Remove link"
          disabled={fmtDisabled || !editor.isActive("link")}
          onClick={() => editor.chain().focus().unsetLink().run()}
        />
        <ToolbarButton
          icon={ImagePlus}
          label="Insert image"
          disabled={fmtDisabled}
          onClick={openImageDialog}
        />
        <Divider />
        <ToolbarButton
          icon={Undo2}
          label="Undo"
          disabled={fmtDisabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          icon={Redo2}
          label="Redo"
          disabled={fmtDisabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />

        {/* Source toggle — right-aligned, always enabled. */}
        <div className="ml-auto">
          <ToolbarButton
            icon={Code2}
            label={mode === "html" ? "Show editor" : "Show HTML"}
            active={mode === "html"}
            onClick={toggleMode}
          />
        </div>
      </div>

      {mode === "html" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label="HTML source"
          className="block min-h-[360px] w-full resize-y bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-text-primary focus:outline-none"
        />
      ) : (
        <EditorContent editor={editor} />
      )}

      {/* Dedicated file input for the image dialog's upload button. */}
      <input
        ref={dialogFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleDialogUpload(file);
          e.target.value = "";
        }}
      />

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rte-link-url">URL</Label>
            <Input
              id="rte-link-url"
              value={linkUrl}
              autoFocus
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
              placeholder="https://example.com"
            />
          </div>
          <DialogFooter>
            {editor.isActive("link") ? (
              <Button variant="ghost" onClick={removeLink}>
                Remove
              </Button>
            ) : null}
            <Button onClick={applyLink}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {imgMode === "edit" ? "Edit image" : "Insert image"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => dialogFileRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />{" "}
                    {imgMode === "edit" ? "Replace image" : "Upload image"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLibraryOpen(true)}
              >
                <Images className="size-4" /> From library
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rte-img-src">Image URL</Label>
              <Input
                id="rte-img-src"
                value={imgSrc}
                onChange={(e) => setImgSrc(e.target.value)}
                placeholder="https://example.com/image.jpg — or upload above"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rte-img-alt">Alt text</Label>
              <Input
                id="rte-img-alt"
                value={imgAlt}
                onChange={(e) => setImgAlt(e.target.value)}
                placeholder="Describe the image (for SEO & accessibility)"
              />
            </div>

            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt={imgAlt || "Preview"}
                className="max-h-40 w-auto rounded-md border border-border"
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={insertImage} disabled={!imgSrc || uploading}>
              {imgMode === "edit" ? "Save" : "Insert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browse the media library to reuse an existing image. */}
      <MediaPickerDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onSelect={({ url, alt }) => {
          setImgSrc(url);
          if (alt) setImgAlt(alt);
        }}
      />
    </div>
  );
}
