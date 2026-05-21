import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const statusColors: Record<string, string> = {
  Verificada: "#22c55e",
  Pendente: "#f59e0b",
  Rejeitada: "#ef4444",
};

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

type Props = {
  parcelas: Parcela[];
};

const ParcelasMap = ({ parcelas }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [-13.5, 14.0],
      zoom: 6,
      scrollWheelZoom: true,
    });

    // Satellite tile layer
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri" }
    ).addTo(map);

    // Labels overlay
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer/tile/{z}/{y}/{x}"
    ).addTo(map);

    // Add markers
    const markers: L.LatLng[] = [];

    parcelas.forEach((p) => {
      const lat = parseFloat(p.lat);
      const lon = parseFloat(p.lon);
      const color = statusColors[p.status] || "#6b7280";
      const latlng = L.latLng(lat, lon);
      markers.push(latlng);

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${color};border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        "><div style="width:8px;height:8px;border-radius:50%;background:white;"></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      L.marker(latlng, { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px;font-family:inherit;">
            <p style="font-weight:700;font-size:14px;margin:0 0 4px">${p.farmer}</p>
            <p style="font-size:12px;color:#6b7280;margin:0 0 6px">${p.farmerId} · ${p.id}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:12px;">
              <span style="color:#6b7280">Cultura:</span><span style="font-weight:600">${p.culture}</span>
              <span style="color:#6b7280">Área:</span><span style="font-weight:600">${p.area}</span>
              <span style="color:#6b7280">Aldeia:</span><span>${p.village}</span>
              <span style="color:#6b7280">Município:</span><span>${p.municipality}</span>
              <span style="color:#6b7280">Estado:</span><span style="font-weight:600;color:${color}">${p.status}</span>
            </div>
            <p style="font-size:11px;color:#9ca3af;margin:6px 0 0">GPS: ${p.lat}, ${p.lon}</p>
          </div>
        `);
    });

    // Fit bounds
    if (markers.length > 0) {
      map.fitBounds(L.latLngBounds(markers), { padding: [40, 40] });
    }

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [parcelas]);

  return (
    <div className="relative z-0 isolate rounded-lg overflow-hidden border border-border">
      <div ref={mapRef} style={{ height: 420, width: "100%" }} />
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
