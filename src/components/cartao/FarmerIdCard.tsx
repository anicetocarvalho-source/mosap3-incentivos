import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { forwardRef } from "react";
import { Phone } from "lucide-react";
import { mosapLogoHorizontal, angolaInsignia, LOGO_SIZES } from "@/config/brand";

export interface FarmerCardData {
  code: string;
  full_name: string;
  photo_url?: string | null;
  province?: string | null;
  municipality?: string | null;
  school?: string | null;
  gender?: string | null;
  bi?: string | null;
  phone?: string | null;
  patec?: number | null;
  status?: string;
  valor_recebido?: string | null;
  saldo_final?: string | null;
  tipo_produtor?: string | null;
  registered_by_name?: string | null;
  registered_by_phone?: string | null;
}


interface Props {
  farmer: FarmerCardData;
  cardToken: string;
  side?: "front" | "back" | "both";
  scale?: number;
}

// CR80 ratio (85.6 × 53.98 mm) preserved
const CARD_W = 340;
const CARD_H = 214;

// Brand greens (HSL values match --primary family used elsewhere)
const GREEN_DARK = "hsl(140, 55%, 18%)";
const GREEN_MID = "hsl(140, 50%, 28%)";
const GREEN_BAR = "hsl(140, 55%, 32%)";
const GREEN_SOFT = "hsl(140, 45%, 95%)";
const GREEN_INK = "hsl(140, 60%, 22%)";
const GOLD = "hsl(42, 85%, 55%)";

const formatDate = (d: Date) =>
  d.toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" });

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";

const getRegistroEstado = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "aprovado" || s === "ativo" || s === "validado") return "ATIVO";
  if (s === "pendente") return "PENDENTE";
  if (s === "removido" || s === "inativo") return "INATIVO";
  return (status || "PENDENTE").toUpperCase();
};

const FarmerIdCard = forwardRef<HTMLDivElement, Props>(
  ({ farmer, cardToken, side = "both", scale = 1 }, ref) => {
    const verifyUrl = `${window.location.origin}/verificacao/${cardToken}`;

    const today = new Date();
    const validade = new Date(today);
    validade.setFullYear(validade.getFullYear() + 5);

    const initials = getInitials(farmer.full_name);
    const escolaCampo = (farmer.school || "—").toUpperCase();
    const registeredByName = farmer.registered_by_name || "—";
    const registeredByPhone = farmer.registered_by_phone || "";



    const cardStyle: React.CSSProperties = {
      width: CARD_W * scale,
      height: CARD_H * scale,
    };
    const innerScale: React.CSSProperties = {
      width: CARD_W,
      height: CARD_H,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
    };

    return (
      <div ref={ref} className="inline-flex flex-col gap-4">
        {/* ============================= FRENTE ============================= */}
        {(side === "front" || side === "both") && (
          <div
            className="relative rounded-xl overflow-hidden border border-border shadow-md bg-white"
            style={cardStyle}
            data-card-side="front"
          >
            <div className="relative bg-white" style={innerScale}>
              {/* Cabeçalho */}
              <div className="flex items-start justify-between px-3 pt-2.5 gap-2">
                {/* Esquerda: Angola */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src={angolaInsignia}
                    alt="República de Angola"
                    className="h-8 w-8 object-contain flex-shrink-0"
                  />
                  <div className="leading-[1.05] min-w-0">
                    <p
                      className="text-[7px] font-extrabold tracking-[0.08em]"
                      style={{ color: GREEN_INK }}
                    >
                      REPÚBLICA DE
                      <br />
                      ANGOLA
                    </p>
                    <p className="text-[5.5px] text-muted-foreground mt-0.5 tracking-wide">
                      Ministério da
                      <br />
                      Agricultura e Florestas
                    </p>
                  </div>
                </div>

                {/* Direita: MOSAP3 (apenas logotipo) */}
                <div className="flex items-center justify-end flex-1 min-w-0">
                  <img
                    src={mosapLogoHorizontal}
                    alt="MOSAP3"
                    className="h-10 object-contain flex-shrink-0"
                  />
                </div>
              </div>


              {/* Faixa verde com título */}
              <div
                className="mt-2 mx-3 rounded-md py-1 px-2 text-center"
                style={{ background: GREEN_BAR }}
              >
                <p className="text-[9px] font-extrabold tracking-[0.1em] text-white">
                  CARTÃO DE IDENTIFICAÇÃO DO AGRICULTOR
                </p>
              </div>

              {/* Corpo: 3 colunas */}
              <div className="flex gap-2.5 px-3 pt-2.5">
                {/* Foto / iniciais */}
                <div
                  className="rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{
                    width: 64,
                    height: 78,
                    background: GREEN_SOFT,
                    border: `1px solid ${GREEN_SOFT}`,
                  }}
                >
                  {farmer.photo_url ? (
                    <img
                      src={farmer.photo_url}
                      alt={farmer.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-[22px] font-extrabold tracking-wider"
                      style={{ color: GREEN_INK }}
                    >
                      {initials}
                    </span>
                  )}
                </div>

                {/* Bloco central */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div>
                    <p className="text-[6px] tracking-[0.1em] text-muted-foreground font-semibold">
                      NOME COMPLETO
                    </p>
                    <p className="text-[9px] font-bold text-foreground truncate uppercase">
                      {farmer.full_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[6px] tracking-[0.1em] text-muted-foreground font-semibold">
                      ID SIGAFLO
                    </p>
                    <p
                      className="text-[9px] font-mono font-bold"
                      style={{ color: GREEN_INK }}
                    >
                      {farmer.code}
                    </p>
                  </div>
                  <div>
                    <p className="text-[6px] tracking-[0.1em] text-muted-foreground font-semibold">
                      BI / NIF
                    </p>
                    <p className="text-[9px] font-mono font-bold text-foreground truncate">
                      {farmer.bi || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[6px] tracking-[0.1em] text-muted-foreground font-semibold">
                      TIPO DE PRODUTOR
                    </p>
                    <p className="text-[8px] font-bold text-foreground truncate">
                      {tipoProdutor}
                    </p>
                  </div>
                </div>

                {/* Bloco direito */}
                <div className="flex-shrink-0 flex flex-col items-end" style={{ width: 86 }}>
                  <div className="self-stretch">
                    <p className="text-[6px] tracking-[0.1em] text-muted-foreground font-semibold">
                      PROVÍNCIA
                    </p>
                    <p className="text-[8px] font-bold text-foreground flex items-center gap-1 truncate">
                      <span
                        className="inline-block w-1 h-1 rounded-full flex-shrink-0"
                        style={{ background: GREEN_INK }}
                      />
                      {(farmer.province || "—").toUpperCase()}
                    </p>
                  </div>
                  <div className="self-stretch mt-1">
                    <p className="text-[6px] tracking-[0.1em] text-muted-foreground font-semibold">
                      MUNICÍPIO
                    </p>
                    <p className="text-[8px] font-bold text-foreground flex items-center gap-1 truncate">
                      <span
                        className="inline-block w-1 h-1 rounded-full flex-shrink-0"
                        style={{ background: GREEN_INK }}
                      />
                      {(farmer.municipality || "—").toUpperCase()}
                    </p>
                  </div>
                  <div className="mt-1 flex items-start gap-1">
                    <div className="bg-white rounded p-[2px] border border-border">
                      <QRCodeSVG value={verifyUrl} size={44} level="M" />
                    </div>
                    <p className="text-[5px] text-muted-foreground leading-[1.1] mt-0.5 font-semibold tracking-wide">
                      VERIFIQUE
                      <br />A<br />
                      AUTENTICIDADE
                      <br />
                      DESTE
                      <br />
                      CARTÃO
                    </p>
                  </div>
                </div>
              </div>

              {/* Rodapé curvo */}
              <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
                <svg
                  viewBox="0 0 340 36"
                  preserveAspectRatio="none"
                  className="w-full h-[36px] block"
                >
                  <path
                    d="M0,16 C70,2 150,28 220,14 C275,3 320,18 340,12 L340,36 L0,36 Z"
                    fill={GREEN_MID}
                    opacity="0.45"
                  />
                  <path
                    d="M0,22 C80,8 160,32 240,20 C290,12 320,22 340,18 L340,36 L0,36 Z"
                    fill={GREEN_DARK}
                  />
                </svg>
                <div className="absolute inset-0 flex items-end justify-between px-3 pb-1.5">
                  {["PRODUZIR", "PRESERVAR", "DESENVOLVER", "INCLUIR"].map((p) => (
                    <span
                      key={p}
                      className="text-[6.5px] font-extrabold tracking-[0.12em] text-white flex items-center gap-1"
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: GOLD }}
                      />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================= VERSO ============================= */}
        {(side === "back" || side === "both") && (
          <div
            className="relative rounded-xl overflow-hidden border border-border shadow-md bg-white"
            style={cardStyle}
            data-card-side="back"
          >
            <div className="relative flex bg-white" style={innerScale}>
              {/* Painel esquerdo verde-escuro */}
              <div
                className="flex flex-col justify-between px-3 py-3 text-white"
                style={{ width: 130, background: GREEN_DARK }}
              >
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[6px] tracking-[0.12em] font-semibold flex items-center gap-1 text-white/80">
                      <span
                        className="inline-block w-1.5 h-1.5"
                        style={{ background: GOLD }}
                      />
                      DATA DE EMISSÃO
                    </p>
                    <p className="text-[11px] font-bold mt-0.5">{formatDate(today)}</p>
                  </div>
                  <div>
                    <p className="text-[6px] tracking-[0.12em] font-semibold flex items-center gap-1 text-white/80">
                      <span
                        className="inline-block w-1.5 h-1.5"
                        style={{ background: GOLD }}
                      />
                      DATA DE VALIDADE
                    </p>
                    <p className="text-[11px] font-bold mt-0.5">{formatDate(validade)}</p>
                  </div>
                  <div>
                    <p className="text-[6px] tracking-[0.12em] font-semibold flex items-center gap-1 text-white/80">
                      <span style={{ color: GOLD }}>✓</span>
                      ESTADO DO REGISTO
                    </p>
                    <p className="text-[11px] font-bold mt-0.5">{estado}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/15">
                  <p
                    className="text-[16px] italic leading-none"
                    style={{ fontFamily: "'Brush Script MT', cursive" }}
                  >
                    Autoridade
                  </p>
                  <p className="text-[6.5px] tracking-[0.14em] font-bold mt-0.5">
                    AUTORIDADE EMISSORA
                  </p>
                </div>
              </div>

              {/* Área direita */}
              <div className="flex-1 flex flex-col px-3 py-2.5 min-w-0">
                {/* Código de barras */}
                <div>
                  <p className="text-[6px] tracking-[0.12em] font-semibold text-muted-foreground">
                    CÓDIGO DE BARRAS
                  </p>
                  <div className="mt-1 flex justify-center">
                    <Barcode
                      value={farmer.code}
                      format="CODE128"
                      width={1.1}
                      height={28}
                      fontSize={8}
                      margin={0}
                      displayValue={true}
                      lineColor={GREEN_INK}
                    />
                  </div>
                </div>

                {/* Linha de apoio */}
                <div
                  className="mt-2 rounded-md px-2 py-1.5"
                  style={{ background: GREEN_SOFT }}
                >
                  <p
                    className="text-[8px] font-extrabold tracking-wide"
                    style={{ color: GREEN_INK }}
                  >
                    LINHA DE APOIO SIGAFLO
                  </p>
                  <div className="flex items-start gap-1 mt-0.5">
                    <Phone
                      size={8}
                      style={{ color: GREEN_INK }}
                      className="mt-[2px] flex-shrink-0"
                    />
                    <div className="text-[7px] text-foreground leading-tight">
                      <p>
                        923 123 456 · apoio@sigaflo.gov.ao
                      </p>
                      <p>www.sigaflo.gov.ao</p>
                    </div>
                  </div>
                </div>

                {/* Dados extra discretos */}
                {(farmer.bi || farmer.phone) && (
                  <div className="mt-1.5 text-[6.5px] text-muted-foreground space-x-2">
                    {farmer.bi && <span>BI: <span className="font-mono">{farmer.bi}</span></span>}
                    {farmer.phone && <span>Tel: <span className="font-mono">{farmer.phone}</span></span>}
                  </div>
                )}

                {/* Disclaimer */}
                <div
                  className="mt-auto border-l-2 pl-2 py-1"
                  style={{ borderColor: GREEN_BAR }}
                >
                  <p className="text-[6.5px] text-muted-foreground leading-tight">
                    Este cartão é pessoal e intransmissível. O uso indevido implica sanções nos termos da lei.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FarmerIdCard.displayName = "FarmerIdCard";
export default FarmerIdCard;
// Note: LOGO_SIZES kept imported for backwards compatibility with consumers; not used directly.
void LOGO_SIZES;
