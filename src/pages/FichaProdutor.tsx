import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Printer, User, MapPin, Phone, CreditCard, Wheat, Calendar, Users, FileText, Camera, Fingerprint, Package, FolderOpen, File, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFarmerFromDb } from "@/hooks/useFarmerFromDb";
import { useFarmerEnrichedData } from "@/hooks/useFarmerEnrichedData";
import { supabase } from "@/integrations/supabase/client";
import { computeSaldoFinal, formatKz } from "@/lib/numberFormat";
import { usePatecLabel } from "@/hooks/usePatecLabel";

const FichaProdutor = () => {
  const { id } = useParams();
  const { farmerInfo, farmer: farmerRaw, loading } = useFarmerFromDb(id);
  const { parcels, production, transactions, dependents, loading: enrichedLoading } = useFarmerEnrichedData(id);
  const { labelByLegacy: patecLabel } = usePatecLabel({ activeOnly: false });

  // Fetch documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  // Composição real do PATEC (fonte: /patec)
  const [patecComposition, setPatecComposition] = useState<{ category: string; items: string[] }[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("farmer_documents")
      .select("*")
      .eq("farmer_code", id)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const docs = data || [];
        setDocuments(docs);
        // Load signed URLs for image docs
        const imgDocs = docs.filter((d: any) => /\.(jpg|jpeg|png|webp|gif)$/i.test(d.file_name));
        if (imgDocs.length > 0) {
          const urls: Record<string, string> = {};
          await Promise.all(
            imgDocs.map(async (d: any) => {
              const { data: signed } = await supabase.storage
                .from("farmer-media")
                .createSignedUrl(d.file_path, 3600);
              if (signed?.signedUrl) urls[d.id] = signed.signedUrl;
            })
          );
          setDocUrls(urls);
        }
        setDocsLoading(false);
      });
  }, [id]);

  const farmer = farmerInfo;

  if (loading || enrichedLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="space-y-6">
        <Link to="/agricultores"><Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button></Link>
        <p className="text-muted-foreground">Produtor não encontrado.</p>
      </div>
    );
  }

  const valorRecebido = farmerRaw?.valor_recebido || "0,00";
  const totalGasto = farmerRaw?.total_gasto || "0,00";
  // Saldo Final canónico: max(0, recebido − gasto). Nunca usar saldo_final da BD.
  const saldoFinal = formatKz(computeSaldoFinal(valorRecebido, totalGasto), false);
  const patecValue = farmerRaw?.patec;

  const currentPatec = patecValue
    ? { title: patecLabel(patecValue), items: patecComposition }
    : null;

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Screen-only header */}
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/agricultores/${farmer.id}`}>
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar ao perfil</Button>
        </Link>
        <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" />Imprimir Ficha</Button>
      </div>

      {/* Printable content */}
      <div className="bg-card border rounded-lg p-8 print:border-0 print:shadow-none print:p-4 space-y-6 text-sm" id="ficha-produtor">
        {/* Header */}
        <div className="text-center border-b border-border pb-4">
          <h1 className="text-xl font-bold font-heading">FICHA DO PRODUTOR</h1>
          <p className="text-xs text-muted-foreground mt-1">Programa MOSAP III — Ficha Individual de Produtor</p>
        </div>

        {/* Section 1: Personal Info */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />1. Dados Pessoais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground text-xs">Nome Completo:</span><p className="font-semibold">{farmer.name}</p></div>
            <div><span className="text-muted-foreground text-xs">Nº BI:</span><p className="font-semibold font-mono">{farmer.bi}</p></div>
            <div><span className="text-muted-foreground text-xs">Telefone:</span><p className="font-semibold">{farmer.phone}</p></div>
            <div><span className="text-muted-foreground text-xs">Género:</span><p className="font-semibold">{farmer.gender}</p></div>
            <div><span className="text-muted-foreground text-xs">Data de Nascimento:</span><p className="font-semibold">{farmer.birthDate}</p></div>
            <div><span className="text-muted-foreground text-xs">Estado:</span>
              <Badge variant={farmer.status === "Ativo" ? "default" : "secondary"} className="mt-0.5">{farmer.status}</Badge>
            </div>
            <div><span className="text-muted-foreground text-xs">Data de Registo:</span><p className="font-semibold">{farmer.registeredAt}</p></div>
          </div>
        </div>

        {/* Section 1b: Fotografias e Biometria */}
        {(farmer.photos || farmer.biometrics) && (
          <div>
            <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />Identificação Visual e Biométrica
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {farmer.photos && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Fotografias</p>
                  <div className="flex gap-3">
                    {[
                      { key: "frontal", label: "Frontal" },
                      { key: "perfilEsq", label: "Perfil Esq." },
                      { key: "perfilDir", label: "Perfil Dir." },
                    ].map((slot) => (
                      <div key={slot.key} className="text-center">
                        {farmer.photos?.[slot.key] ? (
                          <img src={farmer.photos[slot.key]} alt={slot.label} className="h-24 w-20 rounded border border-border object-cover print:h-20 print:w-16" />
                        ) : (
                          <div className="h-24 w-20 rounded border-2 border-dashed border-border bg-muted/20 flex items-center justify-center print:h-20 print:w-16">
                            <Camera className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">{slot.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {farmer.biometrics && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Impressões Digitais</p>
                  <div className="flex gap-3">
                    {[
                      { key: "polegarDir", label: "Polegar Dir." },
                      { key: "indicadorDir", label: "Indicador Dir." },
                      { key: "polegarEsq", label: "Polegar Esq." },
                      { key: "indicadorEsq", label: "Indicador Esq." },
                    ].map((slot) => (
                      <div key={slot.key} className="text-center">
                        <div className={`h-14 w-14 rounded border flex items-center justify-center ${
                          farmer.biometrics?.[slot.key]
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted/20 border-dashed border-border"
                        }`}>
                          <Fingerprint className={`h-6 w-6 ${
                            farmer.biometrics?.[slot.key] ? "text-primary" : "text-muted-foreground/20"
                          }`} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{slot.label}</p>
                        {farmer.biometrics?.[slot.key] && (
                          <p className="text-[9px] text-primary font-medium">✓</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />2. Localização
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground text-xs">Província:</span><p className="font-semibold">{farmer.province}</p></div>
            <div><span className="text-muted-foreground text-xs">Município:</span><p className="font-semibold">{farmer.municipality}</p></div>
            <div><span className="text-muted-foreground text-xs">Escola de Campo:</span><p className="font-semibold">{farmer.school}</p></div>
          </div>
        </div>

        {/* Section 3: Parcels */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />3. Parcelas ({parcels.length})
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">ID</th>
                <th className="text-left px-3 py-2 border-b border-border">Cultura</th>
                <th className="text-right px-3 py-2 border-b border-border">Área</th>
                <th className="text-left px-3 py-2 border-b border-border">Coordenadas</th>
                <th className="text-left px-3 py-2 border-b border-border">Estado</th>
              </tr>
            </thead>
            <tbody>
              {parcels.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Sem parcelas registadas</td></tr>
              ) : parcels.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono">{p.parcel_code}</td>
                  <td className="px-3 py-2">{p.culture}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.area}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{p.lat}, {p.lon}</td>
                  <td className="px-3 py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Production */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Wheat className="h-4 w-4 text-primary" />4. Produção ({production.length})
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">Cultura</th>
                <th className="text-right px-3 py-2 border-b border-border">Área</th>
                <th className="text-left px-3 py-2 border-b border-border">Plantio</th>
                <th className="text-left px-3 py-2 border-b border-border">Colheita Prev.</th>
                <th className="text-left px-3 py-2 border-b border-border">Fase Actual</th>
                <th className="text-left px-3 py-2 border-b border-border">Estado</th>
                <th className="text-right px-3 py-2 border-b border-border">Est. (kg)</th>
                <th className="text-right px-3 py-2 border-b border-border">Real (kg)</th>
              </tr>
            </thead>
            <tbody>
              {production.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">Sem produção registada</td></tr>
              ) : production.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{p.culture}</td>
                  <td className="px-3 py-2 text-right">{p.area}</td>
                  <td className="px-3 py-2">{p.planted_date}</td>
                  <td className="px-3 py-2">{p.expected_harvest}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.current_phase}</Badge></td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 text-right">{p.estimated_yield}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.actual_yield}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 5: Financial */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />5. Resumo Financeiro
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Recebido</p>
              <p className="font-bold text-primary">{valorRecebido} Kz</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Gasto</p>
              <p className="font-bold text-destructive">{totalGasto} Kz</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo Final</p>
              <p className="font-bold">{saldoFinal} Kz</p>
            </div>
          </div>
          {transactions.length > 0 && (
            <table className="w-full text-xs border border-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border-b border-border">Produto</th>
                  <th className="text-left px-3 py-2 border-b border-border">Empresa</th>
                  <th className="text-right px-3 py-2 border-b border-border">Valor</th>
                  <th className="text-left px-3 py-2 border-b border-border">Data</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{t.product}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.empresa}</td>
                    <td className="px-3 py-2 text-right font-semibold">{t.valor} Kz</td>
                    <td className="px-3 py-2">{t.transaction_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 6: Dependents */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />6. Agregado Familiar ({dependents.length})
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">Nome</th>
                <th className="text-left px-3 py-2 border-b border-border">Parentesco</th>
                <th className="text-left px-3 py-2 border-b border-border">Género</th>
                <th className="text-left px-3 py-2 border-b border-border">Data Nasc.</th>
                <th className="text-center px-3 py-2 border-b border-border">Idade</th>
                <th className="text-left px-3 py-2 border-b border-border">Escolaridade</th>
                <th className="text-left px-3 py-2 border-b border-border">Ocupação</th>
              </tr>
            </thead>
            <tbody>
              {dependents.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Sem dependentes</td></tr>
              ) : dependents.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2">{d.relationship}</td>
                  <td className="px-3 py-2">{d.gender}</td>
                  <td className="px-3 py-2">{d.birth_date}</td>
                  <td className="px-3 py-2 text-center">{d.age}</td>
                  <td className="px-3 py-2">{d.education}</td>
                  <td className="px-3 py-2">{d.occupation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 7: Documents */}
        {documents.length > 0 && (
          <div>
            <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />7. Documentos Anexos ({documents.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {documents.map((doc: any) => {
                const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_name);
                const url = docUrls[doc.id];
                const typeLabels: Record<string, string> = { bi: "BI", contrato: "Contrato", certificado: "Certificado", outro: "Outro" };
                return (
                  <div key={doc.id} className="border border-border rounded p-2 text-center">
                    {isImg && url ? (
                      <img src={url} alt={doc.file_name} className="h-20 w-full object-contain rounded mb-1 print:h-16" />
                    ) : (
                      <div className="h-20 flex items-center justify-center print:h-16">
                        {doc.file_name.endsWith(".pdf") ? (
                          <FileText className="h-8 w-8 text-muted-foreground/40" />
                        ) : (
                          <File className="h-8 w-8 text-muted-foreground/40" />
                        )}
                      </div>
                    )}
                    <p className="text-[10px] font-medium truncate">{doc.file_name}</p>
                    <p className="text-[9px] text-muted-foreground">{typeLabels[doc.file_type] || doc.file_type}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 8: PATEC */}
        {currentPatec && (
          <div>
            <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />{documents.length > 0 ? "8" : "7"}. Pacote Tecnológico — {currentPatec.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentPatec.items.map((group) => (
                <div key={group.category} className="border border-border rounded p-3">
                  <p className="text-xs font-semibold mb-2">{group.category}</p>
                  <ul className="text-xs space-y-1">
                    {group.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-4 mt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-muted-foreground mb-8">Assinatura do Produtor</p>
              <div className="border-b border-border" />
              <p className="text-xs text-muted-foreground mt-1">{farmer.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-8">Assinatura do Técnico</p>
              <div className="border-b border-border" />
              <p className="text-xs text-muted-foreground mt-1">Técnico responsável</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-6">Documento gerado automaticamente pelo MOSAP III — {new Date().toLocaleDateString("pt-AO")}</p>
        </div>
      </div>
    </div>
  );
};

export default FichaProdutor;
