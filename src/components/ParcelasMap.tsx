import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const statusColors: Record<string, string> = {
  Verificada: "#22c55e",
  Pendente: "#f59e0b",
  Rejeitada: "#ef4444",
};

const createIcon = (status: string) =>
  L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: ${statusColors[status] || "#6b7280"};
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    "><div style="width:8px;height:8px;border-radius:50%;background:white;"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });

type Parcela = {
  id: string;
  farmer: string;
  farmerId: string;
  province: string;
  municipality: string;
  village: string;
  area: string;
  culture: string;
  lat: string;
  lon: string;
  status: string;
  season: string;
};

function FitBounds({ parcelas }: { parcelas: Parcela[] }) {
  const map = useMap();
  useEffect(() => {
    if (parcelas.length > 0) {
      const bounds = L.latLngBounds(
        parcelas.map((p) => [parseFloat(p.lat), parseFloat(p.lon)] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [parcelas, map]);
  return null;
}

type Props = {
  parcelas: Parcela[];
};

const ParcelasMap = ({ parcelas }: Props) => {
  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ height: 420 }}>
      <MapContainer
        center={[-13.5, 14.0]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        {/* Satellite layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        {/* Labels overlay */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer/tile/{z}/{y}/{x}"
          attribution=""
        />

        <FitBounds parcelas={parcelas} />

        {parcelas.map((p) => (
          <Marker
            key={p.id}
            position={[parseFloat(p.lat), parseFloat(p.lon)]}
            icon={createIcon(p.status)}
          >
            <Popup>
              <div style={{ minWidth: 180, fontFamily: "inherit" }}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.farmer}</p>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{p.farmerId} · {p.id}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>Cultura:</span><span style={{ fontWeight: 600 }}>{p.culture}</span>
                  <span style={{ color: "#6b7280" }}>Área:</span><span style={{ fontWeight: 600 }}>{p.area}</span>
                  <span style={{ color: "#6b7280" }}>Aldeia:</span><span>{p.village}</span>
                  <span style={{ color: "#6b7280" }}>Município:</span><span>{p.municipality}</span>
                  <span style={{ color: "#6b7280" }}>Estado:</span>
                  <span style={{ fontWeight: 600, color: statusColors[p.status] }}>{p.status}</span>
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                  GPS: {p.lat}, {p.lon}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-card border-t border-border text-xs">
        <span className="text-muted-foreground font-medium">Legenda:</span>
        {Object.entries(statusColors).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ParcelasMap;
