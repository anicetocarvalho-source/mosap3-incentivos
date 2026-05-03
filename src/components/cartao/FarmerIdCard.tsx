import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import mosapLogo from "@/assets/mosap3-logo.png";
import { forwardRef } from "react";

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

const CARD_W = 323; // 85.6mm at 96dpi ≈ 323px base
const CARD_H = 204; // 54mm at 96dpi ≈ 204px base

const FarmerIdCard = forwardRef<HTMLDivElement, Props>(
  ({ farmer, cardToken, side = "both", scale = 1 }, ref) => {
    const verifyUrl = `${window.location.origin}/verificacao/${cardToken}`;
    const hasCredit = farmer.valor_recebido && parseFloat(farmer.valor_recebido.replace(/[^\d,-]/g, "").replace(",", ".")) > 0;

    const cardStyle = {
      width: CARD_W * scale,
      height: CARD_H * scale,
      transform: `scale(1)`,
      transformOrigin: "top left",
    };

    return (
      <div ref={ref} className="inline-flex flex-col gap-4">
        {(side === "front" || side === "both") && (
          <div
            className="relative rounded-xl overflow-hidden border border-border shadow-md"
            style={{ ...cardStyle, background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(120,40%,20%) 100%)" }}
            data-card-side="front"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 pt-2" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <img src={mosapLogo} alt="MOSAP3" className="h-7 w-7 rounded-full bg-white p-0.5" />
              <div>
                <p className="text-[10px] font-bold text-white leading-tight">MOSAP3</p>
                <p className="text-[7px] text-white/70 leading-tight">Cartão de Identificação do Agricultor</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex gap-2 px-3 mt-1" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {/* Photo */}
              <div className="w-16 h-20 rounded-md bg-white/20 border border-white/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {farmer.photo_url ? (
                  <img src={farmer.photo_url} alt={farmer.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white/50 text-[8px]">Sem foto</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-white">
                <p className="text-[11px] font-bold truncate leading-tight">{farmer.full_name}</p>
                <p className="text-[8px] text-white/80 font-mono mt-0.5">ID: {farmer.code}</p>
                {farmer.province && (
                  <p className="text-[7px] text-white/70 mt-0.5 truncate">
                    {farmer.province}{farmer.municipality ? ` / ${farmer.municipality}` : ""}
                  </p>
                )}
                {farmer.school && (
                  <p className="text-[7px] text-white/70 truncate">ECA: {farmer.school}</p>
                )}
                {farmer.patec && (
                  <p className="text-[7px] text-white/70">PATEC: {farmer.patec}</p>
                )}
              </div>

              {/* QR */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="bg-white rounded-md p-1">
                  <QRCodeSVG value={verifyUrl} size={52 * scale} level="M" />
                </div>
                <p className="text-[5px] text-white/50 mt-0.5 text-center">Verificar</p>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/20 px-3 py-1 flex items-center justify-between">
              <span className="text-[6px] text-white/60">República de Angola</span>
              <span className={`text-[7px] font-semibold ${farmer.status === "Aprovado" || farmer.status === "Ativo" ? "text-green-300" : "text-yellow-300"}`}>
                {farmer.status || "Pendente"}
              </span>
            </div>
          </div>
        )}

        {(side === "back" || side === "both") && (
          <div
            className="relative rounded-xl overflow-hidden border border-border shadow-md bg-card"
            style={cardStyle}
            data-card-side="back"
          >
            {/* Barcode */}
            <div className="flex justify-center pt-3">
              <Barcode
                value={farmer.code}
                format="CODE128"
                width={1.2 * scale}
                height={35 * scale}
                fontSize={8 * scale}
                margin={0}
                displayValue={true}
              />
            </div>

            {/* Details */}
            <div className="px-4 mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[7px] text-muted-foreground" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              {farmer.bi && (
                <>
                  <span className="font-medium">BI:</span>
                  <span>{farmer.bi}</span>
                </>
              )}
              {farmer.phone && (
                <>
                  <span className="font-medium">Telefone:</span>
                  <span>{farmer.phone}</span>
                </>
              )}
              <span className="font-medium">Elegibilidade:</span>
              <span>{hasCredit ? "Crédito / Incentivo" : "Sem crédito"}</span>
              <span className="font-medium">Emissão:</span>
              <span>{new Date().toLocaleDateString("pt-AO")}</span>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-muted px-3 py-1 text-center">
              <p className="text-[6px] text-muted-foreground">
                Cartão emitido pelo sistema MOSAP3. Para verificar autenticidade, digitalize o QR Code.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FarmerIdCard.displayName = "FarmerIdCard";
export default FarmerIdCard;
