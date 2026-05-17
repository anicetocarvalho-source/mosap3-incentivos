import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { forwardRef } from "react";
import { mosapLogoHorizontal, angolaInsignia } from "@/config/brand";

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
}

interface Props {
  farmer: FarmerCardData;
  cardToken: string;
  side?: "front" | "back" | "both";
  scale?: number;
}

const CARD_W = 340;
const CARD_H = 214;

const StatusBadge = ({ status }: { status?: string }) => {
  const s = (status || "Pendente").toLowerCase();
  const isActive = s === "aprovado" || s === "ativo" || s === "validado";
  const isPending = s === "pendente";
  const cls = isActive
    ? "bg-white/15 text-[hsl(120,80%,80%)]"
    : isPending
      ? "bg-white/15 text-[hsl(45,90%,75%)]"
      : "bg-white/15 text-[hsl(0,80%,80%)]";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold tracking-wide uppercase ${cls}`}>
      {status || "Pendente"}
    </span>
  );
};

const FarmerIdCard = forwardRef<HTMLDivElement, Props>(
  ({ farmer, cardToken, side = "both", scale = 1 }, ref) => {
    const verifyUrl = `${window.location.origin}/verificacao/${cardToken}`;
    const hasCredit =
      farmer.valor_recebido &&
      parseFloat(farmer.valor_recebido.replace(/[^\d,-]/g, "").replace(",", ".")) > 0;

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
        {(side === "front" || side === "both") && (
          <div
            className="relative rounded-xl overflow-hidden border border-border shadow-md"
            style={cardStyle}
            data-card-side="front"
          >
            <div
              className="relative text-white"
              style={{
                ...innerScale,
                background:
                  "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(120,45%,18%) 100%)",
              }}
            >
              {/* Header com 2 marcas */}
              <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-white/10 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={angolaInsignia}
                    alt="República de Angola"
                    className="h-10 w-10 object-contain drop-shadow-sm flex-shrink-0"
                  />
                  <div className="leading-tight min-w-0">
                    <p className="text-[10px] font-extrabold tracking-wider">MINAGRIF</p>
                    <p className="text-[6.5px] text-white/70 truncate">República de Angola</p>
                  </div>
                </div>
                <div className="bg-white/95 rounded px-1.5 py-1 flex-shrink-0">
                  <img
                    src={mosapLogoHorizontal}
                    alt="MOSAP3 — Agro-Pecuária Familiar"
                    className="h-6 object-contain"
                  />
                </div>
              </div>

              {/* Corpo */}
              <div className="flex gap-3 px-3 pt-2.5">
                {/* Foto estilo passaporte 3:4 */}
                <div
                  className="rounded-md bg-white/15 border border-white/40 overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{ width: 66, height: 88 }}
                >
                  {farmer.photo_url ? (
                    <img
                      src={farmer.photo_url}
                      alt={farmer.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white/50 text-[8px]">Sem foto</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[12px] font-bold leading-tight truncate">
                    {farmer.full_name}
                  </p>
                  <p className="text-[8.5px] font-mono text-white/85 mt-0.5">
                    ID: {farmer.code}
                  </p>
                  <div className="mt-1.5 space-y-0.5">
                    {(farmer.province || farmer.municipality) && (
                      <p className="text-[8px] text-white/75 truncate">
                        <span className="text-white/55">Local: </span>
                        {farmer.province}
                        {farmer.municipality ? ` / ${farmer.municipality}` : ""}
                      </p>
                    )}
                    {farmer.school && (
                      <p className="text-[8px] text-white/75 truncate">
                        <span className="text-white/55">ECA: </span>
                        {farmer.school}
                      </p>
                    )}
                    {farmer.patec != null && (
                      <p className="text-[8px] text-white/75 truncate">
                        <span className="text-white/55">PATEC: </span>
                        {farmer.patec}
                      </p>
                    )}
                  </div>
                </div>

                {/* QR */}
                <div className="flex-shrink-0 flex flex-col items-center pt-0.5">
                  <div className="bg-white rounded-md p-1">
                    <QRCodeSVG value={verifyUrl} size={62} level="M" />
                  </div>
                  <p className="text-[6.5px] text-white/65 mt-0.5">Verificar</p>
                </div>
              </div>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/30 flex items-center justify-between">
                <span className="text-[7px] text-white/75">
                  Cartão de Identificação do Agricultor
                </span>
                <StatusBadge status={farmer.status} />
              </div>
            </div>
          </div>
        )}

        {(side === "back" || side === "both") && (
          <div
            className="relative rounded-xl overflow-hidden border border-border shadow-md bg-card"
            style={cardStyle}
            data-card-side="back"
          >
            <div className="relative" style={innerScale}>
              {/* Barcode centrado */}
              <div className="flex flex-col items-center pt-3 pb-2 border-b border-border/60">
                <Barcode
                  value={farmer.code}
                  format="CODE128"
                  width={1.4}
                  height={38}
                  fontSize={9}
                  margin={0}
                  displayValue={true}
                />
              </div>

              {/* Detalhes */}
              <div className="px-4 pt-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[9px]">
                  {farmer.bi && (
                    <>
                      <dt className="text-muted-foreground font-medium">BI:</dt>
                      <dd className="text-foreground font-mono">{farmer.bi}</dd>
                    </>
                  )}
                  {farmer.phone && (
                    <>
                      <dt className="text-muted-foreground font-medium">Telefone:</dt>
                      <dd className="text-foreground font-mono">{farmer.phone}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground font-medium">Elegibilidade:</dt>
                  <dd className="text-foreground">
                    {hasCredit ? "Crédito / Incentivo" : "Sem crédito"}
                  </dd>
                  <dt className="text-muted-foreground font-medium">Emissão:</dt>
                  <dd className="text-foreground">
                    {new Date().toLocaleDateString("pt-AO")}
                  </dd>
                </dl>
              </div>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 bg-muted px-3 py-1.5 text-center space-y-0">
                <p className="text-[7px] text-muted-foreground leading-tight">
                  Cartão emitido pelo sistema MOSAP3 — MINAGRIF / República de Angola.
                </p>
                <p className="text-[7px] text-muted-foreground leading-tight">
                  Para verificar autenticidade, digitalize o QR Code da frente.
                </p>
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
