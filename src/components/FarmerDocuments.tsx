import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, FileText, Trash2, Download, Loader2, File, Image as ImageIcon, Eye, EyeOff, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FarmerDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

const FILE_TYPE_OPTIONS = [
  { value: "bi", label: "BI / Documento de Identidade" },
  { value: "contrato", label: "Contrato / Termo" },
  { value: "certificado", label: "Certificado" },
  { value: "outro", label: "Outro" },
];

const fileTypeLabel = (t: string) => FILE_TYPE_OPTIONS.find((o) => o.value === t)?.label || t;

const isImage = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "");
};

const isPdf = (name: string) => {
  return name.split(".").pop()?.toLowerCase() === "pdf";
};

const fileIcon = (name: string) => {
  if (isImage(name)) return ImageIcon;
  if (isPdf(name)) return FileText;
  return File;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function FarmerDocuments({ farmerCode }: { farmerCode: string }) {
  const [docs, setDocs] = useState<FarmerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState("outro");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("farmer_documents")
      .select("*")
      .eq("farmer_code", farmerCode)
      .order("created_at", { ascending: false });
    const fetched = (data as FarmerDocument[]) || [];
    setDocs(fetched);
    setLoading(false);

    // Pre-load signed URLs for images (thumbnails)
    const imageDocs = fetched.filter((d) => isImage(d.file_name));
    if (imageDocs.length > 0) {
      const urls: Record<string, string> = {};
      await Promise.all(
        imageDocs.map(async (d) => {
          const { data: signed } = await supabase.storage
            .from("farmer-media")
            .createSignedUrl(d.file_path, 3600);
          if (signed?.signedUrl) urls[d.id] = signed.signedUrl;
        })
      );
      setPreviewUrls((prev) => ({ ...prev, ...urls }));
    }
  };

  useEffect(() => { fetchDocs(); }, [farmerCode]);

  const getPreviewUrl = useCallback(async (doc: FarmerDocument) => {
    if (previewUrls[doc.id]) return previewUrls[doc.id];
    const { data } = await supabase.storage
      .from("farmer-media")
      .createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) {
      setPreviewUrls((prev) => ({ ...prev, [doc.id]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  }, [previewUrls]);

  const togglePreview = async (doc: FarmerDocument) => {
    if (expandedId === doc.id) {
      setExpandedId(null);
      return;
    }
    await getPreviewUrl(doc);
    setExpandedId(doc.id);
  };

  const openLightbox = async (doc: FarmerDocument) => {
    const url = await getPreviewUrl(doc);
    if (url) setLightboxUrl(url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ficheiro demasiado grande (máx. 10 MB)");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `documents/${farmerCode}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("farmer-media")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      toast.error("Erro ao carregar ficheiro: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error: dbErr } = await supabase.from("farmer_documents").insert({
      farmer_code: farmerCode,
      file_name: file.name,
      file_path: path,
      file_type: fileType,
      file_size: file.size,
      uploaded_by: userData.user?.id || null,
    });

    if (dbErr) {
      toast.error("Erro ao guardar registo: " + dbErr.message);
    } else {
      toast.success("Documento carregado com sucesso");
      fetchDocs();
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDownload = async (doc: FarmerDocument) => {
    const { data, error } = await supabase.storage
      .from("farmer-media")
      .createSignedUrl(doc.file_path, 300);

    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: FarmerDocument) => {
    const { error: storageErr } = await supabase.storage
      .from("farmer-media")
      .remove([doc.file_path]);

    if (storageErr) {
      toast.error("Erro ao apagar ficheiro");
      return;
    }

    await supabase.from("farmer_documents").delete().eq("id", doc.id);
    toast.success("Documento apagado");
    fetchDocs();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-lg">Documentos</h3>
      </div>

      {/* Upload area */}
      <Card className="p-4 border-dashed border-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Carregar novo documento</p>
            <p className="text-xs text-muted-foreground">PDF, imagens ou outros ficheiros até 10 MB</p>
          </div>
          <div className="flex items-end gap-2">
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-2"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "A carregar..." : "Escolher Ficheiro"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={handleUpload}
            />
          </div>
        </div>
      </Card>

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum documento carregado</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const Icon = fileIcon(doc.file_name);
            const canPreview = isImage(doc.file_name) || isPdf(doc.file_name);
            const isExpanded = expandedId === doc.id;
            const url = previewUrls[doc.id];

            return (
              <Card key={doc.id} className="overflow-hidden hover:bg-muted/30 transition-colors">
                <div className="p-3 flex items-center gap-3">
                  {/* Thumbnail for images */}
                  {isImage(doc.file_name) && url ? (
                    <img
                      src={url}
                      alt={doc.file_name}
                      className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => openLightbox(doc)}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">
                        {fileTypeLabel(doc.file_type)}
                      </span>
                      <span>{formatSize(doc.file_size)}</span>
                      <span>{new Date(doc.created_at).toLocaleDateString("pt")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canPreview && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePreview(doc)} title="Pré-visualizar">
                        {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Inline preview */}
                {isExpanded && url && (
                  <div className="border-t border-border bg-muted/20 p-3">
                    {isImage(doc.file_name) ? (
                      <img
                        src={url}
                        alt={doc.file_name}
                        className="max-h-[400px] mx-auto rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setLightboxUrl(url)}
                      />
                    ) : isPdf(doc.file_name) ? (
                      <iframe
                        src={url}
                        className="w-full h-[500px] rounded-lg border border-border"
                        title={doc.file_name}
                      />
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-background transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
