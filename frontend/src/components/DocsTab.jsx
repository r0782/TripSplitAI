import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, formatApiError } from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { FileText, Image as ImageIcon, Upload, Trash2, Download, X, Loader2, Paperclip } from "lucide-react";
import { format, parseISO } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function fileIcon(ct) {
  if (ct?.startsWith("image/")) return ImageIcon;
  if (ct === "application/pdf") return FileText;
  return Paperclip;
}
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function DocsTab({ trip }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null); // {doc, url}

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${trip.trip_id}/docs`);
      setDocs(data);
    } catch (err) { toast.error("Couldn't load docs", formatApiError(err)); }
    finally { setLoading(false); }
  }, [trip.trip_id, toast]);

  useEffect(() => { load(); }, [load]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too big", "Max 10 MB — try compressing the PDF");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("ts_token");
      const res = await fetch(`${BACKEND_URL}/api/trips/${trip.trip_id}/docs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      const newDoc = await res.json();
      setDocs((p) => [newDoc, ...p]);
      toast.success("Uploaded", file.name);
    } catch (err) { toast.error("Upload failed", err.message || String(err)); }
    finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const remove = async (doc) => {
    try {
      await api.delete(`/trips/${trip.trip_id}/docs/${doc.doc_id}`);
      setDocs((p) => p.filter((d) => d.doc_id !== doc.doc_id));
      toast.success("Removed", doc.filename);
    } catch (err) { toast.error("Delete failed", formatApiError(err)); }
  };

  const docUrl = (doc) => {
    const token = localStorage.getItem("ts_token");
    return `${BACKEND_URL}/api/trips/${trip.trip_id}/docs/${doc.doc_id}?token=${encodeURIComponent(token || "")}`;
  };

  const openViewer = (doc) => setViewer({ doc, url: docUrl(doc) });
  const closeViewer = () => setViewer(null);

  return (
    <div className="space-y-3" data-testid="docs-tab">
      <input type="file" ref={fileInput} className="hidden"
        accept=".pdf,image/png,image/jpeg,image/webp,image/heic,image/gif"
        onChange={onUpload} data-testid="docs-file-input" />

      <button
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        className="w-full bg-white border-2 border-dashed border-brand/30 hover:border-brand rounded-2xl p-5 flex flex-col items-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
        data-testid="docs-upload-btn"
      >
        <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center text-brand">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        </div>
        <div className="text-sm font-semibold">{uploading ? "Uploading…" : "Upload ticket or document"}</div>
        <div className="text-[11px] text-ink-tertiary">PDF, PNG, JPG, WebP, HEIC · Max 10 MB</div>
      </button>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl bg-white animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-black/5" data-testid="docs-empty">
          <Paperclip className="w-6 h-6 text-ink-tertiary mx-auto mb-2" />
          <div className="text-sm font-semibold">Keep everything in one place</div>
          <div className="text-xs text-ink-tertiary mt-0.5">Upload flight tickets, hotel vouchers, visa copies — everyone on the trip can see them.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2" data-testid="docs-grid">
          {docs.map((doc) => {
            const Icon = fileIcon(doc.content_type);
            const isImage = doc.content_type?.startsWith("image/");
            return (
              <motion.div
                key={doc.doc_id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-black/5 overflow-hidden flex flex-col shadow-card"
                data-testid={`doc-${doc.doc_id}`}
              >
                <button onClick={() => openViewer(doc)} className="aspect-[4/3] bg-bg-elevated flex items-center justify-center relative overflow-hidden active:scale-95 transition">
                  {isImage ? (
                    <img src={docUrl(doc)} alt={doc.filename} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex flex-col items-center text-brand">
                      <Icon className="w-8 h-8" strokeWidth={1.5} />
                      <span className="text-[10px] font-bold uppercase tracking-wider mt-1">
                        {doc.filename?.split(".").pop()?.slice(0, 4) || "FILE"}
                      </span>
                    </div>
                  )}
                </button>
                <div className="p-2.5 flex-1 flex flex-col">
                  <div className="text-xs font-semibold truncate" title={doc.filename}>{doc.filename}</div>
                  <div className="text-[10px] text-ink-tertiary mt-0.5 flex items-center justify-between">
                    <span>{formatSize(doc.size)}</span>
                    <span>{format(parseISO(doc.created_at), "MMM d")}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <a href={docUrl(doc)} download={doc.filename} className="text-[11px] text-brand font-semibold inline-flex items-center gap-0.5" data-testid={`doc-download-${doc.doc_id}`}>
                      <Download className="w-3 h-3" /> Save
                    </a>
                    <button onClick={() => remove(doc)} className="text-ink-tertiary p-1" data-testid={`doc-delete-${doc.doc_id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {viewer && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[60] flex flex-col"
            onClick={closeViewer}
            data-testid="doc-viewer"
          >
            <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{viewer.doc.filename}</div>
                <div className="text-[11px] opacity-70">{formatSize(viewer.doc.size)}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a href={viewer.url} download={viewer.doc.filename} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white" data-testid="viewer-download">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={closeViewer} className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white" data-testid="viewer-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
              {viewer.doc.content_type?.startsWith("image/") ? (
                <img src={viewer.url} alt={viewer.doc.filename} className="max-w-full max-h-full object-contain rounded-lg" />
              ) : viewer.doc.content_type === "application/pdf" ? (
                <iframe src={viewer.url} title={viewer.doc.filename} className="w-full h-full bg-white rounded-lg" />
              ) : (
                <div className="text-white text-center">
                  <Paperclip className="w-10 h-10 mx-auto opacity-60 mb-2" />
                  <div className="text-sm">Preview not available</div>
                  <a href={viewer.url} download={viewer.doc.filename} className="inline-flex items-center gap-1 mt-3 bg-white text-black font-semibold px-4 py-2 rounded-full text-sm">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
