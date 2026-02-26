import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Trash2, Download, Loader2, File, Image as ImageIcon } from "lucide-react";
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

const fileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return ImageIcon;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("farmer_documents")
      .select("*")
      .eq("farmer_code", farmerCode)
      .order("created_at", { ascending: false });
    setDocs((data as FarmerDocument[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [farmerCode]);

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
            return (
              <Card key={doc.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
